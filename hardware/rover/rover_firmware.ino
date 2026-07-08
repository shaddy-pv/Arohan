/* =================================================================
 *  AROHHAN ROVER — FINAL CORRECTED VERSION
 *
 *  Based on team's v5.0 (their pin map + motor directions preserved)
 *
 *  FIXES APPLIED:
 *  [1] Turns use RELATIVE angle from start — NOT drifting absolute IMU heading
 *  [2] Obstacle avoidance works DURING replay (not disabled)
 *  [3] LINE_KP reduced 8→4, MAXC 60→40 (was oscillating/zigzagging)
 *  [4] Straight timeout 3x recorded time (was 2x, too short)
 *  [5] Obstacle resume tracks REMAINING distance (was retrying full step)
 *  [6] Settle time 150ms + angle re-sync between every step
 *  [7] TURN_SLOW increased 8→15 degrees (smoother deceleration into turn)
 *  [8] UI buttons changed to HOLD-TO-MOVE (touchstart/mousedown = move,
 *      touchend/mouseup = stop) — no more click-to-toggle
 *  [9] Gyro correction on straight lines kept (team's good addition)
 *  [10] Path sanity check printed on boot
 *  [11] WiFi AP never disappears:
 *       - AP started first (AP-only), then STA added in background
 *       - WiFi.setSleep(false) prevents power-saving from killing AP
 *       - Channel 6 instead of 1 (less interference)
 *       - Passive WiFi scan for homing (was active — disrupted AP)
 *       - fbTask no longer calls WiFi.begin() in a loop (was fighting AP)
 *  [12] WEB DEBUG: Turn debugging info displayed live on dashboard
 *
 *  PARTITION: Tools > Partition > "Huge APP (3MB No OTA/1MB SPIFFS)"
 * ================================================================= */

#include <ESPmDNS.h>
#include <MPU6050.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <Wire.h>
#include <math.h>
#include <time.h>

const int REN = 4, RIN1 = 13, RIN2 = 15;
const int LEN = 26, LIN1 = 27, LIN2 = 14;
const int TRIG = 18, ECHO = 19;
const int LENC = 25, RENC = 32;
const int MQ2P = 33, MQ135P = 35;
#include <DHT.h>
const int DHTPIN = 23;
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);
const int RGB_B = 2;
const int RGB_R = 12;
const int RGB_G = 5;

WiFiClient wifiClient;

// ========================== CONFIG ==========================
const char *AP_SSID = "Arohhan_Rover";
const char *AP_PASS = "12345678";

// --- HOME WIFI SETTINGS ---
// Enter your Home Wi-Fi credentials here:
const char *STA_SSID = "Airtel_Fearless";
const char *STA_PASS = "Fearless@1234";
// --------------------------

// STA/Firebase REMOVED — ESP32 is AP+STA, Python server handles Firebase

#define BLE_SVC "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_CHR "beb5483e-36e1-4688-b7f5-ea07361b26a8"

int mSpd = 150; // ← lowered from 180 — replay was too fast
const int SPD_MIN = 115,
          SPD_MAX = 220; // Lowered 140→115: at mSpd=150, rPWM=134 was clamped
                         // to 140 causing rightward drift
const int BOOST_ADD = 20, BOOST_MS = 50;

// ── TURN SPEED FIX ─────────────────────────────────────────────────────
const int TURN_KICK_SPD = 175; // burst to overcome stiction at start (was 210)
const int TURN_KICK_MS = 180;  // how long burst lasts (ms)
const int TURN_RUN_SPD = 175;  // normal turn speed once moving (was 210)
const int TURN_SLOW_SPD_R =
    118; // right slow-creep: midpoint between 95(undershoot) and 125(overshoot)
const int TURN_SLOW_SPD_L = 128; // left  slow-creep: midpoint between
                                 // 105(undershoot) and 135(overshoot)
const int MANUAL_TURN_SPD = 155; // slow enough to control precisely

// ── STRAIGHT DRIFT FIX ─────────────────────────────────────────────────
const int DRIFT_BIAS = -15; // negative = right motor gets +8 PWM pre-bias to
                            // counteract rightward drift
const bool CORR_INVERT = false;

float LTRIM = 1.0f, RTRIM = 1.0f;

const float OBS_CM = 10.0f, DIST_MIN = 2.0f;
const float WDIA = 6.5f, TPR = 40.0f;
const float CM_TICK = (3.14159f * WDIA) / TPR;

// Time for 180° U-turn when MPU6050 is absent (no gyro).
// TUNE THIS: if rover undershoots, raise it; if it overshoots, lower it.
const unsigned long UTURN_MS = 3200; // ms at cruise speed to complete ~180°

const char *HAZ_PFX = "HAZARD_";
const int HOME_RSSI = -40, HOME_SPD = 160, HOME_MAX_T = 12;
const float HOME_ADV = 50.0f, HOME_DEG = 30.0f, HOME_TOL = 3.0f;
const unsigned long HOME_TTOUT = 3000;
const unsigned long COOL_MS = 300000;
const int SCAN_N = 12;
const float SCAN_DEG = 30.0f;

const float TURN_TOL = 2.0f;
const float TURN_SLOW = 32.0f;
const float LINE_KP = 4.0f;
const int LINE_MAXC = 40;

unsigned long lastCmdMs = 0;
bool watchdogActive = false;

// ========================== TYPES ==========================
enum Dir { STOP = 0, FWD, BWD, LEFT, RIGHT };
struct Step {
  Dir d;
  float v;
  unsigned long ms;
};
#define MAXST 100

enum HmSt { HM_IDLE = 0, HM_SCAN, HM_ROT, HM_DRV, HM_AVO, HM_ARR, HM_LOST };
enum MiSt {
  MI_IDLE = 0,
  MI_START,
  MI_PATH,
  MI_HOME,
  MI_ARRIVE,
  MI_SENSE,
  MI_UPLOAD,
  MI_GASFOLLOW,
  MI_RETURN,
  MI_DONE,
  MI_FAIL
};

struct ScanPt {
  float ang;
  int g2, g1;
  float t, h;
  float dst;
};

// ========================== MATH ==========================
float normA(float a) {
  while (a > 180.0f)
    a -= 360.0f;
  while (a <= -180.0f)
    a += 360.0f;
  return a;
}
float diffA(float tgt, float cur) { return normA(tgt - cur); }

// ========================== PWM ==========================
void setupPWM() {
  // ESP32 Arduino Core 3.x supports standard analogWrite natively.
  // This automatically uses the best hardware timer frequency for motor torque.
  // No need for manual ledcAttach.
}
void rPWM(int v) {
  v = constrain((int)(v * RTRIM), 0, 255);
  analogWrite(REN, v);
}
void lPWM(int v) {
  v = constrain((int)(v * LTRIM), 0, 255);
  analogWrite(LEN, v);
}

// ========================== FORWARD DECL ==========================
extern const char HTML_PAGE[];
void sendOK(const char *m);
void handleCmd(String cmd);

// ========================== GLOBALS ==========================
WebServer srv(80);
MPU6050 imu;
NimBLECharacteristic *pChr = nullptr;
Preferences prefs;

// Path management
String savedPaths[20]; // Store up to 20 path names
int savedPathCount = 0;
String currentPathName = "";
String pendingDeleteName =
    ""; // set by dashboard delete; server reads via /getlocalpath, then clears
        // via /cleardeleteflag
bool pathListReady = false;

Dir curD = STOP;
bool moving = false, avoidOn = false;
bool recOn = false, repOn = false, mpuOK = false;
float dist = 999.0f, totDist = 0, ang = 0;
float gBiasZ = 0;
unsigned long lastGyro = 0, bootT = 0, lastGas = 0;
int mqA = 0, mqB = 0;
float temperature = -1.0;
float humidity = -1.0;
float hazardScore = 0;
const char *riskLevel = "SAFE";
bool callingStatus = false;
int mq135Value = 400; // mapped value like IoT node

volatile long lTk = 0, rTk = 0;
long pLT = 0, pRT = 0;
bool boosting = false;
unsigned long boostEnd = 0;
Dir boostD = STOP;
int boostTgt = 180;
int avSt = 0;
unsigned long avTm = 0;

// Non-blocking ultrasonic
volatile unsigned long echoSt = 0, echoDur = 0;
volatile bool echoNew = false;
enum USmode { US_IDLE, US_TRIG, US_WAIT };
USmode usM = US_IDLE;
unsigned long usTm = 0, usLast = 0;
#define DBF 5
float dBuf[DBF];
int dBi = 0;
bool dBFull = false;

// Recording
Step path[MAXST];
int sCnt = 0, cStep = 0;
Dir recD = STOP;
long rSLT = 0, rSRT = 0;
float rSAng = 0;
unsigned long rSTm = 0;

// Replay
int rpSt = 0;
unsigned long rpTm = 0;
long rpLT = 0, rpRT = 0;
float rpSA = 0;
float rpTgtA = 0;
bool rpPause = false;
unsigned long rpSTm = 0;
bool revMode = false;

float rpRemaining = 0.0f;
bool rpResuming = false;
unsigned long rpTurnKickEnd = 0;

float rpLastStallAng = 0;
unsigned long rpLastStallCheck = 0;
bool rpStallKicking = false;
unsigned long rpStallKickEnd = 0;
bool uTurnStarted =
    false; // global — was 'static' inside case 6 which broke 2nd+ reverse runs

Dir usrDir = STOP;

// Debug display
String turnDebug = "";
unsigned long lastTurnDbg = 0;

// Homing
HmSt hmSt = HM_IDLE;
bool hmOn = false;
unsigned long hmTm = 0;
int bstRSSI = -100;
float bstAng = 0;
int tCnt = 0, hmCyc = 0;
long hmSLT = 0, hmSRT = 0;
float hmTgt = 0, hmScanA = 0;
String tgtSSID = "";
String hmMsg = "Idle";
int hmSub = 0;
bool wfScanning = false;

// Firebase stubs — variables kept for mission system compilation
// They are NEVER set to true (fbTask removed), so ESP32 auto-dispatch is dead.
// Python server handles all Firebase + dispatch via /pushpath and /runreverse.
volatile bool fbCalling = false;
volatile bool fbScanReady = false;
volatile bool fbScanDone = false;
volatile bool fbScanOK = false;
volatile bool fbPathReady = false;
volatile bool fbResetCall = false;
ScanPt fbScanCp[SCAN_N];
bool autoDisp = false;
String staIP = "";

// Mission
MiSt miSt = MI_IDLE;
unsigned long miTm = 0, lastMiEnd = 0;
String miMsg = "Idle";

// Scan
ScanPt scanD[SCAN_N];
int scIdx = 0, scSub = 0;
bool scOn = false, scDone = false;
float scLastA = 0;
unsigned long scTm = 0;

// ── GAS FOLLOW (Presentation Demo Mode) ───────────
enum GfSt { GF_SCAN_WAIT = 0, GF_SCAN_TURN, GF_DRIVE, GF_DONE };
GfSt gfSt = GF_SCAN_WAIT;
int baseLeft = 0;
int baseRight = 0;
unsigned long gfTm = 0;
unsigned long gfStart = 0; // Tracks total time in gas follow mode for timeout
float gfTurnStartA = 0;    // Tracks angle at start of gas scan turn
long gfDrvLT = 0;
long gfDrvRT = 0;

// ========================== ISR ==========================
void IRAM_ATTR iL() { lTk++; }
void IRAM_ATTR iR() { rTk++; }
void IRAM_ATTR iE() {
  if (digitalRead(ECHO) == HIGH) {
    echoSt = micros();
  } else {
    unsigned long d = micros() - echoSt;
    if (d > 150 && d < 25000) {
      echoDur = d;
      echoNew = true;
    }
  }
}

// ========================== BLE ==========================
class SrvCB : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer *, NimBLEConnInfo &) override {}
  void onDisconnect(NimBLEServer *, NimBLEConnInfo &, int) override {
    NimBLEDevice::startAdvertising();
  }
};
class ChrCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c, NimBLEConnInfo &) override {
    std::string v = c->getValue();
    if (v.length() > 0) {
      String s = String(v.c_str());
      s.trim();
      s.toUpperCase();
      handleCmd(s);
    }
  }
};

void setRGB(bool r, bool g, bool b) {
  digitalWrite(RGB_R, r ? LOW : HIGH);
  digitalWrite(RGB_G, g ? LOW : HIGH);
  digitalWrite(RGB_B, b ? LOW : HIGH);
}

// ========================== MOTORS (team's direction logic)
// ==========================
void setMot(Dir d, int s) {
  switch (d) {
  case FWD:
    digitalWrite(RIN1, LOW);
    digitalWrite(RIN2, HIGH);
    digitalWrite(LIN1, LOW);
    digitalWrite(LIN2, HIGH);
    rPWM(s);
    lPWM(s);
    moving = true;
    break;
  case BWD:
    digitalWrite(RIN1, HIGH);
    digitalWrite(RIN2, LOW);
    digitalWrite(LIN1, HIGH);
    digitalWrite(LIN2, LOW);
    rPWM(s);
    lPWM(s);
    moving = true;
    break;
  case LEFT:
    digitalWrite(RIN1, LOW);
    digitalWrite(RIN2, HIGH);
    digitalWrite(LIN1, HIGH);
    digitalWrite(LIN2, LOW);
    rPWM(s);
    lPWM(s);
    moving = true;
    break;
  case RIGHT:
    digitalWrite(RIN1, HIGH);
    digitalWrite(RIN2, LOW);
    digitalWrite(LIN1, LOW);
    digitalWrite(LIN2, HIGH);
    rPWM(s);
    lPWM(s);
    moving = true;
    break;
  default:
    digitalWrite(RIN1, LOW);
    digitalWrite(RIN2, LOW);
    digitalWrite(LIN1, LOW);
    digitalWrite(LIN2, LOW);
    rPWM(0);
    lPWM(0);
    moving = false;
    break;
  }
  curD = d;
}

void startMot(Dir d, int spd) {
  if (d == STOP) {
    setMot(STOP, 0);
    boosting = false;
    return;
  }
  if (boosting && d != boostD)
    boosting = false;
  setMot(d, constrain(spd + BOOST_ADD, 0, 255));
  boosting = true;
  boostEnd = millis() + BOOST_MS;
  boostD = d;
  boostTgt = spd;
}

void drv(Dir d) {
  avSt = 0;
  rpPause = false;
  if (d == STOP) {
    setMot(STOP, 0);
    boosting = false;
  } else if (d == LEFT || d == RIGHT) {
    setMot(d, MANUAL_TURN_SPD); // direct set — no boost cycle for manual
  } else {
    setMot(d, mSpd); // direct set — no boost cycle for manual
  }
  usrDir = d;
}

void stopM() {
  setMot(STOP, 0);
  boosting = false;
}

void updBoost() {
  if (!boosting)
    return;
  if (curD != boostD) {
    boosting = false;
    return;
  }
  if (millis() >= boostEnd) {
    setMot(boostD, boostTgt);
    boosting = false;
  }
}

// ========================== ULTRASONIC ==========================
void sortF(float *a, int n) {
  for (int i = 1; i < n; i++) {
    float k = a[i];
    int j = i - 1;
    while (j >= 0 && a[j] > k) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = k;
  }
}
void procDist(float raw) {
  if (raw < DIST_MIN || raw > 400.0f)
    raw = 999.0f;
  dBuf[dBi] = raw;
  dBi = (dBi + 1) % DBF;
  if (dBi == 0)
    dBFull = true;
  int c = dBFull ? DBF : dBi;
  if (c < 1)
    return;
  float tmp[DBF];
  memcpy(tmp, dBuf, c * sizeof(float));
  sortF(tmp, c);
  dist = tmp[c / 2];
}
void updUS() {
  switch (usM) {
  case US_IDLE:
    if (millis() - usLast >= 50) {
      digitalWrite(TRIG, HIGH);
      usTm = micros();
      usM = US_TRIG;
    }
    break;
  case US_TRIG:
    if (micros() - usTm >= 10) {
      digitalWrite(TRIG, LOW);
      echoNew = false;
      usTm = micros();
      usLast = millis();
      usM = US_WAIT;
    }
    break;
  case US_WAIT:
    if (echoNew) {
      procDist((echoDur * 0.0343f) / 2.0f);
      usM = US_IDLE;
    } else if (micros() - usTm > 25000) {
      procDist(999.0f);
      usM = US_IDLE;
    }
    break;
  }
}

// ========================== SENSORS ==========================
void rdGas() {
  mqA = analogRead(MQ2P);   // MQ2 raw (0–4095 on ESP32)
  mqB = analogRead(MQ135P); // MQ135 raw analog (0–4095)

  // -- Software Baseline Calibration --
  // Shift the 1500 baseline down to 0 so it reads normally
  if (mqA > 1500) {
    mqA -= 1500;
  } else {
    mqA = 0;
  }

  bool air_quality_bad = (mqB >= 1600);
  mq135Value = air_quality_bad ? 800 : 400;

  hazardScore = 0;
  // Thresholds rescaled down by 1500 since we subtracted 1500 from mqA
  if (mqA >= 1700)
    hazardScore += 40;
  else if (mqA >= 1100)
    hazardScore += 30;
  else if (mqA >= 100)
    hazardScore += 10;

  if (temperature > 50.0)
    hazardScore += 30; // High temperature (fire risk)
  else if (temperature > 40.0)
    hazardScore += 10; // Elevated temperature

  if (air_quality_bad)
    hazardScore += 10;

  if (hazardScore > 100)
    hazardScore = 100;

  if (hazardScore <= 30)
    riskLevel = "SAFE";
  else if (hazardScore <= 60)
    riskLevel = "WARNING";
  else
    riskLevel = "DANGER";

  callingStatus = (hazardScore >= 50.0f);

  // ── Serial debug every ~2s (rdGas called every 200ms, print every 10th) ──
  static int gasDbgCnt = 0;
  if (++gasDbgCnt >= 10) {
    gasDbgCnt = 0;
    Serial.printf("[SENS] MQ2(raw)=%d  MQ135(raw)=%d  Temp=%.1f  Hum=%.1f  "
                  "Hazard=%.0f  Risk=%s\n",
                  mqA, mqB, temperature, humidity, hazardScore, riskLevel);
  }
}
void rdDHT() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(h) && !isnan(t)) {
    humidity = h;
    temperature = t;
  }
}

// ========================== GYRO ==========================
void calGyro() {
  if (!mpuOK)
    return;
  Serial.print("[GYRO] Calibrating");
  delay(300); // was 1500 — enough for chip to settle
  float sum = 0;
  for (int i = 0; i < 150; i++) { // was 500 — 150 samples is plenty
    int16_t x, y, z;
    imu.getRotation(&x, &y, &z);
    sum += z / 131.0f;
    delay(4);
    if (i % 50 == 0)
      Serial.print(".");
  }
  gBiasZ = sum / 150.0f; // match sample count
  Serial.printf(" bias=%.4f\n", gBiasZ);
}
void updGyro() {
  if (!mpuOK)
    return;
  unsigned long now = millis();
  float dt = (now - lastGyro) / 1000.0f;
  if (dt < 0.004f)
    return;
  if (dt > 0.1f)
    dt = 0.1f;
  int16_t x, y, z;
  imu.getRotation(&x, &y, &z);
  float r = (z / 131.0f) - gBiasZ;
  if (fabs(r) < 0.5f)
    r = 0;
  ang += r * dt;
  ang = normA(ang);
  lastGyro = now;
}
void updOdom() {
  noInterrupts();
  long cl = lTk, cr = rTk;
  interrupts();
  float avg = ((cl - pLT) + (cr - pRT)) * CM_TICK / 2.0f;
  totDist += fabs(avg);
  pLT = cl;
  pRT = cr;
}

// ========================== OBSTACLE AVOIDANCE ==========================
void doAvoid() {
  if (!avoidOn)
    return;
  if (revMode)
    return; // Never avoid during reverse replay — rover faces opposite
            // direction, sonar would trigger false positives for obstacles
            // behind it
  switch (avSt) {
  case 0:
    if (dist >= DIST_MIN && dist < OBS_CM && moving && curD == FWD) {
      setMot(BWD, mSpd);
      boosting = false;
      avTm = millis() + 350;
      avSt = 1;
    }
    break;
  case 1:
    if (millis() >= avTm) {
      setMot(RIGHT, mSpd);
      avTm = millis() + 400;
      avSt = 2;
    }
    break;
  case 2:
    if (millis() >= avTm) {
      stopM();
      avSt = 0;
    }
    break;
  }
}

// ========================== RECORDING ==========================
void recFin() {
  if (recD == STOP)
    return;
  unsigned long el = millis() - rSTm;
  noInterrupts();
  long cl = lTk, cr = rTk;
  interrupts();
  float val = 0;
  if (recD == FWD || recD == BWD) {
    long ed = (cl - rSLT) + (cr - rSRT);
    val = fabs(ed * CM_TICK / 2.0f);
  } else {
    val = fabs(diffA(ang, rSAng));
  }
  if ((val > 1.0f || el > 150) && sCnt < MAXST) {
    path[sCnt].d = recD;
    path[sCnt].v = val;
    path[sCnt].ms = el;
    sCnt++;
    const char *dn[] = {"?", "FWD", "BWD", "L", "R"};
    Serial.printf("[REC] %d: %s %.1f %lums\n", sCnt, dn[recD], val, el);
  }
  recD = STOP;
}
void recSt(Dir d) {
  if (!recOn || d == recD)
    return;
  recFin();
  if (d != STOP) {
    recD = d;
    rSTm = millis();
    noInterrupts();
    rSLT = lTk;
    rSRT = rTk;
    interrupts();
    rSAng = ang;
  }
}
void beginRec() {
  if (miSt != MI_IDLE)
    return;
  sCnt = 0;
  recOn = true;
  repOn = false;
  recD = STOP;
  stopM();
  Serial.println("[REC] Started — drive slowly, pause 1s between changes");
}
void savePath() {
  prefs.begin("path", false);
  prefs.putInt("cnt", sCnt);
  for (int i = 0; i < sCnt; i++) {
    char k[8];
    snprintf(k, 8, "d%d", i);
    prefs.putInt(k, (int)path[i].d);
    snprintf(k, 8, "v%d", i);
    prefs.putFloat(k, path[i].v);
    snprintf(k, 8, "t%d", i);
    prefs.putULong(k, path[i].ms);
  }
  prefs.end();
  Serial.printf("[PATH] Saved: %d steps\n", sCnt);
}
void loadPath() {
  prefs.begin("path", true);
  sCnt = prefs.getInt("cnt", 0);
  if (sCnt > MAXST)
    sCnt = 0;
  for (int i = 0; i < sCnt; i++) {
    char k[8];
    snprintf(k, 8, "d%d", i);
    path[i].d = (Dir)prefs.getInt(k, 0);
    snprintf(k, 8, "v%d", i);
    path[i].v = prefs.getFloat(k, 0);
    snprintf(k, 8, "t%d", i);
    path[i].ms = prefs.getULong(k, 0);
  }
  prefs.end();
  if (sCnt > 0) {
    Serial.printf("[PATH] Loaded %d steps:\n", sCnt);
    const char *dn[] = {"STOP", "FWD", "BWD", "LEFT", "RIGHT"};
    for (int i = 0; i < sCnt; i++) {
      Serial.printf("  %d: %s val=%.1f ms=%lu\n", i, dn[path[i].d], path[i].v,
                    path[i].ms);
    }
  } else {
    Serial.println("[PATH] No path in flash. Record one first.");
  }
}
void endRec() {
  recFin();
  recOn = false;
  Serial.printf("[REC] Done: %d steps\n", sCnt);
  if (sCnt > 0) {
    savePath();
    // fbPathReady removed — Python server polls /getlocalpath
  }
}

// ========================== REPLAY ==========================
Dir flipD(Dir d) {
  // Only mirror turns — FWD stays FWD because rover turns 180° first
  switch (d) {
  case LEFT:
    return RIGHT;
  case RIGHT:
    return LEFT;
  default:
    return d; // FWD stays FWD, BWD stays BWD
  }
}
Step getStep(int i) {
  int idx = revMode ? (sCnt - 1 - i) : i;
  if (idx < 0 || idx >= sCnt) {
    Step s;
    s.d = STOP;
    s.v = 0;
    s.ms = 0;
    return s;
  }
  Step s = path[idx];
  if (revMode)
    s.d = flipD(s.d);
  return s;
}
void beginRep() {
  if (sCnt == 0) {
    Serial.println("[REP] No path!");
    return;
  }
  if (recOn)
    endRec();
  repOn = true;
  cStep = 0;
  rpPause = false;
  rpResuming = false;
  rpRemaining = 0.0f;
  rpTurnKickEnd = 0;
  uTurnStarted =
      false; // must reset so 180° U-turn executes correctly every time

  // Reset encoders
  noInterrupts();
  lTk = 0;
  rTk = 0;
  interrupts();
  pLT = 0;
  pRT = 0;
  totDist = 0;

  // IMPORTANT: Let everything settle before starting
  stopM();
  // NO delay here — WiFi needs to keep running
  if (revMode) {
    rpSt = 6; // Start with 180° turn before playing reversed path
    Serial.println("[REP] Will turn 180° before reverse replay");
  } else {
    rpSt = 0; // Normal forward replay
  }

  turnDebug = "";
  Serial.printf("[REP] Start %s: %d steps, startAngle=%.1f\n",
                revMode ? "REVERSE" : "FORWARD", sCnt, ang);
}
void endRep() {
  repOn = false;
  rpSt = 0;
  rpPause = false;
  revMode = false;
  rpResuming = false;
  rpRemaining = 0.0f;
  rpTurnKickEnd = 0;
  stopM();
  turnDebug = "Idle";
  Serial.println("[REP] Done");
}

void doReplay() {
  if (!repOn)
    return;
  if (avSt != 0) {
    if (!rpPause)
      rpPause = true;
    return;
  }
  if (rpPause) {
    rpPause = false;
    noInterrupts();
    rpLT = lTk;
    rpRT = rTk;
    interrupts();
    rpSTm = millis();
  }

  switch (rpSt) {
  // ── STEP START ──────────────────────────────────────────────────
  case 0: {
    if (cStep >= sCnt) {
      endRep();
      return;
    }
    stopM();
    noInterrupts();
    rpLT = lTk;
    rpRT = rTk;
    interrupts();
    rpResuming = false;
    rpRemaining = 0.0f;
    rpTm = millis() + 350; // 350ms settle so rover fully stops between steps
    rpSt = 5;              // go to settle — do NOT capture ang here
    break;
  }

  // ── STRAIGHT LINE ────────────────────────────────────────────────
  case 1: {
    Step s = getStep(cStep);

    if (curD == FWD && dist >= DIST_MIN && dist < OBS_CM) {

      stopM();
      noInterrupts();
      long cl = lTk, cr = rTk;
      interrupts();
      float alreadyDriven = fabs(((cl - rpLT) + (cr - rpRT)) * CM_TICK / 2.0f);
      rpRemaining = s.v - alreadyDriven;
      if (rpRemaining < 2.0f)
        rpRemaining = 0.0f;
      rpResuming = true;
      Serial.printf("[REP] Obstacle! driven=%.1f remaining=%.1f\n",
                    alreadyDriven, rpRemaining);
      rpSt = 4;
      rpTm = millis();
      break;
    }

    noInterrupts();
    long cl = lTk, cr = rTk;
    interrupts();
    long ld = cl - rpLT, rd = cr - rpRT;
    float driven = fabs((ld + rd) * CM_TICK / 2.0f);

    int encCorr = (int)(LINE_KP * (float)(CORR_INVERT ? (rd - ld) : (ld - rd)));
    encCorr = constrain(encCorr, -LINE_MAXC, LINE_MAXC);

    int gyroCorr = 0;
    if (mpuOK) { // no warmup delay — correct from very first loop tick
      float headErr = diffA(rpSA, ang);
      gyroCorr = (int)(+6.0f * headErr);
      gyroCorr = constrain(gyroCorr, -25, 25);
    }

    int totalCorr = constrain(encCorr + gyroCorr, -LINE_MAXC, LINE_MAXC);
    // FIX — flip it, slow down right, speed up left:
    lPWM(constrain(mSpd - totalCorr + DRIFT_BIAS, SPD_MIN, SPD_MAX));
    rPWM(constrain(mSpd + totalCorr - DRIFT_BIAS, SPD_MIN, SPD_MAX));

    // Subtract coast offset: motor coasts after stopM(), so command stop early.
    // If rover still overruns: increase 3.0f → 4.0f. If it stops short: lower
    // it.
    float target = rpResuming ? rpRemaining : (s.v > 4.0f ? s.v - 3.0f : s.v);
    bool dEnc = (target > 0.5f && driven >= target);
    unsigned long tt = s.ms * 3;
    if (tt < 1500)
      tt = 1500;
    bool dTm = (millis() - rpSTm >= tt);

    if (dEnc) {
      stopM();
      Serial.printf("[REP] Straight done enc=%.1f target=%.1f\n", driven,
                    target);
      cStep++;
      rpTm = millis() + 600; // 600ms pause — rover fully stops before next step
      rpSt = 3;
    } else if (dTm) {
      stopM();
      Serial.printf("[REP] Straight TIMEOUT driven=%.1f target=%.1f\n", driven,
                    target);
      cStep++;
      rpTm = millis() + 600; // 600ms pause — same pause after timeout
      rpSt = 3;
    }
    break;
  }

    // ── TURN ──────────────────────────────────────────────────────────
    // ── TURN ──────────────────────────────────────────────────────────
  case 2: {
    if (!mpuOK) {
      Step s = getStep(cStep);
      unsigned long tt = s.ms * 2;
      if (tt < 800)
        tt = 800;
      if (millis() - rpSTm >= tt) {
        stopM();
        cStep++;
        rpTm = millis() + 150;
        rpSt = 3;
        turnDebug = "Done(no MPU)";
      }
      break;
    }
    float rem = diffA(rpTgtA, ang);
    float ar = fabs(rem);

    if (millis() - lastTurnDbg > 100) {
      lastTurnDbg = millis();
      char buf[80];
      snprintf(buf, 80, "A:%.1f T:%.1f rem:%.1f", ang, rpTgtA, rem);
      turnDebug = String(buf);
    }

    if (ar < TURN_TOL) {
      stopM();
      turnDebug = "DONE rem=" + String(rem, 1);
      Serial.printf("[REP] Turn DONE rem=%.1f\n", rem);
      cStep++;
      rpTm = millis() +
             500; // 500ms pause after turn — lets rover settle before next move
      rpSt = 3;
      break;
    }

    Step s = getStep(cStep);
    unsigned long tt = s.ms * 4;
    if (tt < 2000)
      tt = 2000;
    if (millis() - rpSTm >= tt) {
      stopM();
      turnDebug = "TIMEOUT rem=" + String(rem, 1);
      Serial.printf("[REP] Turn TIMEOUT rem=%.1f\n", rem);
      cStep++;
      rpTm = millis() + 500; // 500ms pause after timeout too
      rpSt = 3;
      break;
    }

    Dir td = (rem > 0) ? LEFT : RIGHT;
    int ts;

    if (millis() < rpTurnKickEnd) {
      ts = TURN_KICK_SPD;
    } else if (ar < TURN_SLOW) {
      ts = (td == LEFT) ? TURN_SLOW_SPD_L : TURN_SLOW_SPD_R;
      // Stall recovery: if angle hasn't moved in 300ms, kick it
      if (!rpStallKicking) {
        if (millis() - rpLastStallCheck > 300) {
          if (fabs(ang - rpLastStallAng) < 0.8f) {
            Serial.printf("[REP] Stall @ rem=%.1f kicking\n", rem);
            rpStallKicking = true;
            rpStallKickEnd = millis() + 100;
          }
          rpLastStallAng = ang;
          rpLastStallCheck = millis();
        }
      }
      if (rpStallKicking) {
        if (millis() >= rpStallKickEnd)
          rpStallKicking = false;
        else
          ts = TURN_KICK_SPD;
      }
    } else {
      ts = TURN_RUN_SPD;
    }

    setMot(td, ts);
    break;
  }

  // ── SETTLE BETWEEN STEPS ─────────────────────────────────────────
  case 3:
    // Motors should already be stopped
    // Just wait for the pause time
    if (millis() >= rpTm) { // Refresh angle reference
      rpResuming = false;
      rpRemaining = 0.0f;
      rpSt = 0; // Go to next step
    }
    break;

  // ── OBSTACLE WAIT + RESUME ────────────────────────────────────────
  case 4: {
    if (dist >= OBS_CM || dist < DIST_MIN) {
      Step s = getStep(cStep);
      float target = rpResuming ? rpRemaining : s.v;
      if (target <= 2.0f) {
        Serial.println("[REP] Obstacle cleared, step done, skipping");
        cStep++;
        rpTm = millis() + 50;
        rpSt = 3;
      } else {
        noInterrupts();
        rpLT = lTk;
        rpRT = rTk;
        interrupts();
        rpSTm =
            millis(); // ← reset timeout clock NOW, obstacle pause doesn't count
        Serial.printf("[REP] Obstacle cleared, resuming %.1f cm\n", target);
        startMot(s.d, mSpd);
        rpSt = 1;
      }
    } else if (millis() - rpTm >= 15000) {
      stopM();
      Serial.println("[REP] Obstacle timeout — skipping step");
      cStep++;
      rpTm = millis() + 300;
      rpSt = 3;
    }
    break;
  }

    // ── PRE-STEP SETTLE — dispatches to straight (1) or turn (2) ──
  case 5: {
    if (millis() < rpTm)
      break;

    // Zero angle HERE, after settle, every single step.
    // This means accumulated gyro drift from the previous turn
    // can never corrupt this step's corrections.
    ang = 0;
    rpSA = 0;
    noInterrupts();
    rpLT = lTk;
    rpRT = rTk;
    interrupts();

    Step s = getStep(cStep);
    const char *dn[] = {"?", "F", "B", "L", "R"};
    Serial.printf("[REP] Step %d/%d: %s %.1f\n", cStep + 1, sCnt, dn[s.d], s.v);

    if (s.d == FWD || s.d == BWD) {
      rpSTm = millis();
      startMot(s.d, mSpd);
      rpSt = 1;
      turnDebug = "";
    } else if (s.d == LEFT || s.d == RIGHT) {
      // Target is relative to zero — clean every step
      rpTgtA = (s.d == LEFT ? s.v : -s.v);
      // Reset stall tracker for this turn
      rpLastStallAng = 0;
      rpLastStallCheck = millis() + 400;
      rpStallKicking = false;
      setMot(s.d, TURN_KICK_SPD);
      rpTurnKickEnd = millis() + TURN_KICK_MS;
      rpSTm = millis();
      turnDebug = "TURN tgt=" + String(rpTgtA, 1);
      Serial.printf("[REP] Turn target=%.1f\n", rpTgtA);
      rpSt = 2;
    } else {
      cStep++;
      rpSt = 0;
    }
    break;
  }

  // ── 180° U-TURN (before reverse replay) ────────────────────────
  case 6: {
    // uTurnStarted is now a global variable (was static — broke every 2nd
    // reverse run)
    if (!uTurnStarted) {
      // Zero the angle and start turning
      stopM();
      ang = 0;
      // Target 175° not 180° — rover has momentum at slow speed and will
      // coast ~5° further before truly stopping. This prevents overshoot.
      rpTgtA = 175.0f;
      rpSTm = millis();
      rpLastStallAng = 0;
      rpLastStallCheck = millis() + 400;
      rpStallKicking = false;
      setMot(LEFT,
             170); // Strong kick to overcome stiction (130 was too weak = teeee
                   // stall)
      rpTurnKickEnd = millis() + TURN_KICK_MS;
      uTurnStarted = true;
      turnDebug = "U-TURN 180°";
      Serial.println("[REP] Starting 180° U-turn (target 175deg)");
      break;
    }

    // ── NO-MPU PATH ─────────────────────────────────────────────────
    // Without gyro, ang=0 always → ar=175 → done-check NEVER fires.
    // Use UTURN_MS (tunable constant, line ~93) instead.
    if (!mpuOK) {
      if (millis() - rpSTm >= UTURN_MS) {
        stopM();
        uTurnStarted = false;
        rpTm = millis() + 600;
        rpSt = 0;
        turnDebug = "U-TURN done(time)";
        Serial.println("[REP] U-turn done (time-based, no MPU)");
      }
      if (millis() >= rpTurnKickEnd)
        setMot(LEFT, 180);
      break;
    }
    // ── GYRO PATH (mpuOK) ───────────────────────────────────────────

    float rem = diffA(rpTgtA, ang);
    float ar = fabs(rem);

    if (millis() - lastTurnDbg > 100) {
      lastTurnDbg = millis();
      char buf[80];
      snprintf(buf, 80, "U-TURN A:%.1f rem:%.1f", ang, rem);
      turnDebug = String(buf);
    }

    // Done turning? — 8° tolerance catches rover before momentum coasts it past
    // target
    if (ar < 8.0f) {
      stopM();
      Serial.printf("[REP] 180 U-turn DONE (ang=%.1f)\n", ang);
      turnDebug = "U-TURN done";
      uTurnStarted = false;
      rpTm = millis() + 400; // Extra settle after U-turn before reverse begins
      rpSt = 0;
      break;
    }

    // Timeout safety (10 seconds max for 180° turn at slower speed)
    if (millis() - rpSTm >= 10000) {
      stopM();
      Serial.printf("[REP] 180° TIMEOUT (ang=%.1f)\n", ang);
      uTurnStarted = false;
      rpTm = millis() + 400;
      rpSt = 0;
      break;
    }

    // Turn speed control — U-turn specific speeds
    Dir td = (rem > 0) ? LEFT : RIGHT;
    int ts;
    if (millis() < rpTurnKickEnd) {
      ts = 130;              // Gentle kick
    } else if (ar < 40.0f) { // Slow zone at 40° (widened for more decel runway)
      ts = (td == LEFT) ? 60 : 50; // Slower creep — reduced 100/90→80/70
    } else {
      ts = 140; // Cruising speed
    }
    setMot(td, ts);
    break;
  }
  }
}

// ========================== RSSI HOMING ==========================
void startScan() {
  WiFi.scanNetworks(true, false, true, 100);
  wfScanning = true;
}
int chkScan() {
  if (!wfScanning)
    return -1000;
  int n = WiFi.scanComplete();
  if (n == WIFI_SCAN_RUNNING)
    return -1000;
  wfScanning = false;
  if (n < 0) {
    WiFi.scanDelete();
    return -999;
  }
  int best = -999;
  String bs = "";
  for (int i = 0; i < n; i++) {
    String s = WiFi.SSID(i);
    if (s.startsWith(HAZ_PFX)) {
      int r = WiFi.RSSI(i);
      if (r > best) {
        best = r;
        bs = s;
      }
    }
  }
  WiFi.scanDelete();
  if (best > -999)
    tgtSSID = bs;
  return best;
}
void startHome() {
  hmOn = true;
  hmSt = HM_SCAN;
  hmSub = 0;
  hmCyc = 0;
  hmMsg = "Scanning...";
  stopM();
  wfScanning = false;
  Serial.println("[HOME] Started");
}
void stopHome() {
  hmOn = false;
  hmSt = HM_IDLE;
  hmSub = 0;
  hmMsg = "Idle";
  stopM();
  wfScanning = false;
}

void doHome() {
  if (!hmOn)
    return;
  switch (hmSt) {
  case HM_SCAN: {
    if (hmSub == 0) {
      bstRSSI = -999;
      bstAng = ang;
      hmScanA = ang;
      tCnt = 0;
      hmMsg = "Scanning...";
      startScan();
      hmSub = 1;
    } else {
      int r = chkScan();
      if (r == -1000)
        break;
      if (r > -999) {
        bstRSSI = r;
        bstAng = ang;
        if (r >= HOME_RSSI) {
          hmSt = HM_ARR;
          break;
        }
      }
      hmTgt = normA(ang + HOME_DEG);
      setMot(LEFT, HOME_SPD);
      hmTm = millis() + HOME_TTOUT;
      hmSt = HM_ROT;
      hmSub = 0;
      tCnt = 1;
    }
    break;
  }
  case HM_ROT: {
    float rem = fabs(diffA(hmTgt, ang));
    bool tc = (rem < HOME_TOL), tt = (millis() >= hmTm);
    if (tc || tt) {
      stopM();
      if (hmSub == 0) {
        startScan();
        hmSub = 1;
      } else {
        int r = chkScan();
        if (r == -1000)
          break;
        if (r > bstRSSI) {
          bstRSSI = r;
          bstAng = ang;
        }
        if (r >= HOME_RSSI) {
          hmSt = HM_ARR;
          break;
        }
        tCnt++;
        hmSub = 0;
        if (tCnt > HOME_MAX_T) {
          if (bstRSSI <= -999) {
            hmSt = HM_LOST;
            hmMsg = "No signal";
            break;
          }
          float ad = diffA(bstAng, ang);
          if (fabs(ad) > HOME_TOL) {
            hmTgt = bstAng;
            setMot(ad > 0 ? LEFT : RIGHT, HOME_SPD);
            hmTm = millis() + HOME_TTOUT;
            hmSt = HM_DRV;
            hmSub = 1;
            hmMsg = "Aiming...";
          } else {
            hmSt = HM_DRV;
            hmSub = 0;
          }
          break;
        }
        hmTgt = normA(hmScanA + tCnt * HOME_DEG);
        setMot(LEFT, HOME_SPD);
        hmTm = millis() + HOME_TTOUT;
      }
    }
    break;
  }
  case HM_DRV: {
    if (hmSub == 1) {
      float rem = fabs(diffA(hmTgt, ang));
      if (rem < HOME_TOL || millis() >= hmTm) {
        stopM();
        hmSub = 0;
        noInterrupts();
        hmSLT = lTk;
        hmSRT = rTk;
        interrupts();
        startMot(FWD, mSpd);
        hmMsg = "Driving...";
      }
      break;
    }
    if (dist >= DIST_MIN && dist < OBS_CM) {

      stopM();
      hmSt = HM_AVO;
      hmSub = 0;
      hmTm = millis() + 400;
      hmMsg = "Avoiding...";
      break;
    }
    noInterrupts();
    long cl = lTk, cr = rTk;
    interrupts();
    float dr = fabs(((cl - hmSLT) + (cr - hmSRT)) * CM_TICK / 2.0f);
    if (dr >= HOME_ADV) {
      stopM();
      hmCyc++;
      hmSt = HM_SCAN;
      hmSub = 0;
    }
    break;
  }
  case HM_AVO: {
    switch (hmSub) {
    case 0:
      setMot(BWD, mSpd);
      hmTm = millis() + 400;
      hmSub = 1;
      break;
    case 1:
      if (millis() >= hmTm) {
        setMot(RIGHT, mSpd);
        hmTm = millis() + 400;
        hmSub = 2;
      }
      break;
    case 2:
      if (millis() >= hmTm) {
        stopM();
        hmSub = 0;
        hmSt = HM_SCAN;
        hmSub = 0;
      }
      break;
    }
    break;
  }
  case HM_ARR:
    stopM();
    hmMsg = "ARRIVED!";
    Serial.printf("[HOME] RSSI=%d\n", bstRSSI);

    hmOn = false;
    hmSt = HM_IDLE;
    break;
  case HM_LOST:
    stopM();
    hmMsg = "Lost signal";
    hmOn = false;
    hmSt = HM_IDLE;
    break;
  default:
    break;
  }
}

// ========================== AREA SCAN ==========================
void beginScan() {
  scOn = true;
  scDone = false;
  scIdx = 0;
  scSub = 0;
  Serial.println("[SCAN] Start");
}
void doScan() {
  if (!scOn)
    return;
  switch (scSub) {
  case 0:
    rdGas();
    rdDHT();
    scanD[scIdx].ang = ang;
    scanD[scIdx].g2 = mqA;
    scanD[scIdx].g1 = mqB;
    scanD[scIdx].t = temperature;
    scanD[scIdx].h = humidity;
    scanD[scIdx].dst = dist;
    Serial.printf("[SCAN] %d: a=%.0f g=%d q=%d t=%.1f h=%.1f d=%.0f\n", scIdx,
                  ang, mqA, mqB, temperature, humidity, dist);
    scIdx++;
    scLastA = ang;
    setMot(LEFT, HOME_SPD);
    scTm = millis();
    scSub = 1;
    break;
  case 1: {
    float t = fabs(diffA(ang, scLastA));
    bool dG = (mpuOK && t >= SCAN_DEG - 3.0f), dT = (millis() - scTm >= 1500);
    if (dG || dT) {
      stopM();
      scTm = millis();
      scSub = 2;
    }
    break;
  }
  case 2:
    if (millis() - scTm >= 200) {
      if (scIdx >= SCAN_N) {
        scOn = false;
        scDone = true;
        Serial.println("[SCAN] Done!");
      } else
        scSub = 0;
    }
    break;
  }
}

// ========================== FIREBASE REMOVED ==========================
// All Firebase communication handled by Python server
void setFBSt(const char *s) {
  Serial.printf(
      "[FB-STUB] setFBSt(%s) — no-op, Python server handles Firebase\n", s);
}

// ========================== GAS FOLLOW ==========================
void startGasFollow() {
  gfSt = GF_SCAN_WAIT;
  // Record clean air baseline for both sensors
  baseLeft = mqA;
  baseRight = mqB;
  gfTm = millis();
  gfStart = millis(); // Initialize timeout tracker
  stopM();            // Stay completely still at start!
  Serial.println("[GF] === PRESENTATION DEMO MODE STARTED ===");
}

void doGasFollow() {
  if (gfSt == GF_DONE)
    return;

  // Calculate how much gas INCREASED above the dynamic baseline
  int deltaLeft = mqA - baseLeft;
  int deltaRight = mqB - baseRight;

  // TIMEOUT: If 20 seconds pass without finding the source, give up and return!
  if (millis() - gfStart > 20000) {
    Serial.println("[GF] TIMEOUT! Gas not found. Returning to dock.");
    stopM();
    gfSt = GF_DONE;
    miMsg = "Gas timeout — returning";
    revMode = true;
    beginRep();
    miSt = MI_RETURN;
    return;
  }

  // If either sensor is maxed out, we reached the destination!
  if (mqA >= 2000 || mqB >= 2000) {
    Serial.println("[GF] SOURCE FOUND!");
    stopM();
    gfSt = GF_DONE;
    miMsg = "GF done — arrived";
    revMode = true;
    beginRep();
    miSt = MI_RETURN;
    return;
  }

  // WAKE UP THRESHOLD: If ANY sensor detects a new spray of gas (> 60 spike)
  if (gfSt == GF_SCAN_WAIT || gfSt == GF_SCAN_TURN) {
    if (deltaLeft > 60 || deltaRight > 60) {
      // GAS DETECTED! Instantly drive 20cm STRAIGHT using encoders.
      setMot(FWD, 150);
      gfSt = GF_DRIVE;
      gfDrvLT = lTk;
      gfDrvRT = rTk;
      gfTm = millis(); // Track when FWD started for path recording
      Serial.println("[GF] GAS DETECTED! Charging 20cm STRAIGHT!");
      return;
    }
  }

  // ENCODER-BASED 20cm DRIVE
  if (gfSt == GF_DRIVE) {
    float ticks = ((lTk - gfDrvLT) + (rTk - gfDrvRT)) / 2.0f;
    float cmDone = ticks * CM_TICK;

    // If we reached 20cm OR something is blocking us
    if (cmDone >= 20.0f || dist < OBS_CM) {
      stopM();

      // Record this straight charge so we can reverse it perfectly later!
      if (sCnt < MAXST) {
        path[sCnt].d = FWD;
        path[sCnt].v = 0; // Forward driving doesn't have an angle
        path[sCnt].ms = millis() - gfTm;
        sCnt++;
      }

      gfSt = GF_SCAN_WAIT;
      gfTm = millis();
      // Update the baseline to the current high reading!
      // This prevents it from instantly re-triggering due to slow sensor
      // recovery.
      baseLeft = mqA;
      baseRight = mqB;
      Serial.println("[GF] Finished 20cm. Waiting 3s...");
    } else {
      setMot(FWD, 150); // Keep driving
    }
    return;
  }

  // STEP-BY-STEP 360 SCAN LOGIC
  if (gfSt == GF_SCAN_WAIT) {
    // Every 50ms, slowly decay the baseline to recover sensitivity as gas
    // clears
    static unsigned long lastDecay = 0;
    if (millis() - lastDecay > 50) {
      lastDecay = millis();
      if (baseLeft > 0)
        baseLeft--;
      if (baseRight > 0)
        baseRight--;
    }

    // Wait 3.0 seconds to give the user time to spray the gas.
    if (millis() - gfTm > 3000) {
      setMot(LEFT,
             120); // LOWERED FROM 160 to prevent motor current spike brownouts
      gfSt = GF_SCAN_TURN;
      gfTm = millis();
      extern float ang;
      gfTurnStartA = ang; // RECORD START ANGLE HERE
      Serial.println("[GF] Scanning turn...");
    }
  } else if (gfSt == GF_SCAN_TURN) {
    // Stop turning after 550ms (~30 degrees).
    if (millis() - gfTm > 550) {
      stopM();

      // Record the exact gyro angle turned so we can accurately reverse it!
      if (sCnt < MAXST) {
        path[sCnt].d = LEFT;
        extern float ang;
        extern float diffA(float tgt, float cur);
        path[sCnt].v = mpuOK ? fabs(diffA(ang, gfTurnStartA)) : 0;
        path[sCnt].ms = millis() - gfTm;
        sCnt++;
      }

      gfSt = GF_SCAN_WAIT;
      gfTm = millis();
      // Re-calibrate baseline after turning to ignore residual gas
      baseLeft = mqA;
      baseRight = mqB;
      Serial.println("[GF] Scan pause...");
    }
  }
}

// ========================== MISSION ==========================
void startMission() {
  if (miSt != MI_IDLE)
    return;
  if (sCnt == 0) {
    Serial.println("[MI] No path!");
    return;
  }

  miSt = MI_START;
  miMsg = "Starting...";
  setFBSt("DISPATCHED");
  Serial.println("[MI] Dispatched");
}
void stopMission() {
  miSt = MI_FAIL;
  miMsg = "User stopped";
  repOn = false;
  hmOn = false;
  hmSt = HM_IDLE;
  scOn = false;
  scDone = false;
  revMode = false;
  wfScanning = false;
  stopM();
  Serial.println("[MI] Stopped");
}
void doMission() {
  switch (miSt) {
  case MI_IDLE:
    if (fbCalling && autoDisp && sCnt > 0) {
      if (millis() - lastMiEnd > COOL_MS || lastMiEnd == 0) {
        miSt = MI_START;
        miMsg = "Auto-dispatch...";
        setFBSt("DISPATCHED");
        Serial.println("[MI] Auto!");
      }
    }
    break;
  case MI_START:
    miMsg = "Path replay...";
    revMode = false;
    beginRep();
    miSt = MI_PATH;
    miTm = millis();
    break;
  case MI_PATH:
    miMsg = "Following path...";
    if (!repOn) {
      stopM();
      miMsg = "Arrived! Waiting for server to start gas hunt...";
      miSt = MI_ARRIVE;
      miTm = millis();
    }
    if (millis() - miTm > 180000) {
      endRep();
      stopM();
      miMsg = "Path timeout — waiting for server...";
      miSt = MI_ARRIVE;
      miTm = millis();
    }
    break;
  case MI_GASFOLLOW:
    miMsg = "Following gas...";
    doGasFollow();
    break;
  case MI_HOME:
    miMsg = "Homing: " + hmMsg;
    if (!hmOn)
      miSt = MI_ARRIVE;
    if (millis() - miTm > 120000) {
      stopHome();
      miSt = MI_ARRIVE;
    }
    break;
  case MI_ARRIVE:
    stopM();
    miMsg = "Arrived! Waiting for server command...";
    // Python server will monitor /rstatus and call /startgas when it sees
    // ARRIVE
    break;
  case MI_SENSE:
    miMsg = "Scanning " + String(scIdx) + "/" + String(SCAN_N);
    if (scDone) {
      memcpy(fbScanCp, scanD, sizeof(scanD));
      fbScanDone = false;
      fbScanReady = true;
      miMsg = "Uploading...";
      miTm = millis();
      miSt = MI_UPLOAD;
    }
    break;
  case MI_UPLOAD:
    // FIX: fbScanDone is NEVER set (Firebase removed from ESP32).
    // Python server reads scan data via /rstatus polling — no need to wait
    // here. Immediately start reverse replay to return to dock.
    setFBSt("RETURNING");
    miMsg = "Returning to dock...";
    revMode = true;
    beginRep();
    miSt = MI_RETURN;
    break;
  case MI_RETURN:
    miMsg = "Return " + String(cStep + 1) + "/" + String(sCnt);
    if (!repOn)
      miSt = MI_DONE;
    break;
  case MI_DONE:
    stopM();
    revMode = false;
    miMsg = "Complete!";
    lastMiEnd = millis();

    setFBSt("IDLE");
    // fbResetCall removed — Python server handles Firebase
    Serial.println("[MI] COMPLETE!");
    miSt = MI_IDLE;
    break;
  case MI_FAIL:
    stopM();
    revMode = false;
    repOn = false;
    hmOn = false;
    hmSt = HM_IDLE;
    scOn = false;
    wfScanning = false;
    lastMiEnd = millis();
    setFBSt("IDLE");
    Serial.printf("[MI] FAIL: %s\n", miMsg.c_str());
    miSt = MI_IDLE;
    break;
  }
}

// ========================== COMMANDS ==========================
void handleCmd(String c) {
  if (miSt != MI_IDLE) {
    if (c == "STOP" || c == "S" || c == "STOPMISSION")
      stopMission();
    return;
  }
  if (repOn && c != "STOP" && c != "S" && c != "STOPRUN")
    return;
  if (hmOn && c != "STOP" && c != "S" && c != "STOPHOME")
    return;

  // ── WATCHDOG RESET ─────────────────────────────────
  if (c == "F" || c == "FORWARD" || c == "B" || c == "BACKWARD" || c == "L" ||
      c == "LEFT" || c == "R" || c == "RIGHT") {
    lastCmdMs = millis();
    watchdogActive = true;
  }

  if (c == "F" || c == "FORWARD") {
    recSt(FWD);
    drv(FWD);
  } else if (c == "B" || c == "BACKWARD") {
    recSt(BWD);
    drv(BWD);
  } else if (c == "L" || c == "LEFT") {
    recSt(LEFT);
    drv(LEFT);
  } else if (c == "R" || c == "RIGHT") {
    recSt(RIGHT);
    drv(RIGHT);
  } else if (c == "S" || c == "STOP") {
    recSt(STOP);
    drv(STOP);
    watchdogActive = false;
  } else if (c == "REC")
    beginRec();
  else if (c == "STOPREC")
    endRec();
  else if (c == "RUN") {
    revMode = false;
    beginRep();
  } else if (c == "STOPRUN")
    endRep();
  else if (c == "HOME")
    startHome();
  else if (c == "STOPHOME")
    stopHome();
  else if (c == "MISSION")
    startMission();
  else if (c == "STOPMISSION")
    stopMission();
}

void updWatchdog() {
  if (!watchdogActive)
    return;
  if (!repOn && !hmOn && !scOn && miSt == MI_IDLE) {
    if (millis() - lastCmdMs > 3000) {
      stopM();
      watchdogActive = false;
    }
  }
}
void updRGB() {
  if (miSt == MI_PATH || miSt == MI_START) {
    setRGB(1, 0, 0); // red — dispatched/following path
  } else if (miSt == MI_HOME || miSt == MI_RETURN) {
    setRGB(0, 0, 1); // blue — returning
  } else if (miSt == MI_ARRIVE || miSt == MI_SENSE || miSt == MI_UPLOAD) {
    setRGB(1, 0, 1); // purple — at destination, scanning
  } else if (miSt == MI_DONE) {
    setRGB(0, 1, 0); // green — complete
  } else if (repOn || hmOn) {
    setRGB(1, 1, 0); // yellow — replaying manually
  } else if (recOn) {
    setRGB(0, 0, 1); // blue — recording
  } else if (moving) {
    setRGB(1, 1, 0); // yellow — manual drive
  } else {
    setRGB(0, 1, 0); // green — idle/ready
  }
}

// ========================== WEB HANDLERS ==========================
void hRoot() { srv.send_P(200, "text/html", HTML_PAGE); }
void sendOK(const char *m) {
  srv.sendHeader("Connection", "close");
  srv.send(200, "text/plain", m);
}
void hFwd() {
  handleCmd("FORWARD");
  sendOK("FORWARD");
}
void hBwd() {
  handleCmd("BACKWARD");
  sendOK("BACKWARD");
}
void hLft() {
  handleCmd("LEFT");
  sendOK("LEFT");
}
void hRgt() {
  handleCmd("RIGHT");
  sendOK("RIGHT");
}
void hStp() {
  handleCmd("STOP");
  sendOK("STOPPED");
}
void hRec() {
  beginRec();
  sendOK("Recording");
}
void hSRec() {
  endRec();
  sendOK("Stopped");
}
void hRun() {
  revMode = false;
  beginRep();
  sendOK("Replaying");
}
void hGasFollow() {
  stopM();
  startGasFollow();
  miSt = MI_GASFOLLOW;
  miTm = millis();
  sendOK("Gas Follow Started");
}
void hSRun() {
  endRep();
  sendOK("Stopped");
}
void hHm() {
  startHome();
  sendOK("Homing");
}
void hSHm() {
  stopHome();
  sendOK("Off");
}
void hMi() {
  startMission();
  sendOK("Mission");
}
void hSMi() {
  stopMission();
  sendOK("Stopped");
}
void hSens() {
  const char *dn[] = {"STOP", "FWD", "BWD", "LEFT", "RIGHT"};
  const char *hs[] = {"idle",  "scan",    "rotate", "drive",
                      "avoid", "ARRIVED", "lost",   "?"};
  const char *ms[] = {"IDLE",   "START", "PATH",   "HOME",
                      "ARRIVE", "SENSE", "UPLOAD", "GASFOLLOW",
                      "RETURN", "DONE",  "FAIL"};

  // Read raw gyro for debug
  int16_t gx = 0, gy = 0, gz = 0;
  if (mpuOK) {
    imu.getRotation(&gx, &gy, &gz);
  }

  char j[2200];
  snprintf(j, 2200,
           "{\"dist\":%.1f,\"total\":%.1f,\"angle\":%.1f,"
           "\"mq2\":%d,\"mq135\":%d,\"temperature\":%.1f,\"humidity\":%.1f,"
           "\"rec\":%s,\"rep\":%s,\"steps\":%d,\"mov\":%s,"
           "\"av\":%s,\"spd\":%d,\"heap\":%d,\"dir\":\"%s\","
           "\"ms\":\"%s\",\"msMsg\":\"%s\","
           "\"ad\":%s,\"staC\":%s,\"staIP\":\"%s\","
           "\"rev\":%s,\"scI\":%d,\"rpCur\":%d,"
           "\"homing\":%s,\"hSt\":\"%s\",\"hMsg\":\"%s\","
           "\"hCyc\":%d,\"rssi\":%d,\"node\":\"%s\","
           "\"tdbg\":\"%s\",\"mpuOK\":%s,\"gz\":%d,\"bias\":%.2f,\"pathName\":"
           "\"%s\","
           "\"hazard\":%.0f,\"risk\":\"%s\",\"calling\":%s}",
           dist, totDist, ang, mqA, mqB, temperature, humidity,
           recOn ? "true" : "false", repOn ? "true" : "false", sCnt,
           moving ? "true" : "false", avoidOn ? "true" : "false", mSpd,
           (int)ESP.getFreeHeap(), dn[curD], miSt < 11 ? ms[miSt] : "?",
           miMsg.c_str(), autoDisp ? "true" : "false",
           (WiFi.status() == WL_CONNECTED) ? "true" : "false", staIP.c_str(),
           revMode ? "true" : "false", scIdx, cStep, hmOn ? "true" : "false",
           hmSt < 7 ? hs[hmSt] : "?", hmMsg.c_str(), hmCyc, bstRSSI,
           tgtSSID.c_str(), turnDebug.c_str(), mpuOK ? "true" : "false", gz,
           gBiasZ, currentPathName.c_str(), hazardScore, riskLevel,
           callingStatus ? "true" : "false");

  srv.sendHeader("Connection", "close");
  srv.send(200, "application/json", j);
}
// Run path in REVERSE — used by Python server for auto-return to dock
void hRunRev() {
  if (sCnt == 0) {
    sendOK("No path");
    return;
  }
  revMode = true;
  beginRep();
  sendOK("Returning");
}
void hAvoid() {
  if (srv.hasArg("e")) {
    avoidOn = (srv.arg("e") == "1");
    if (!avoidOn)
      avSt = 0;
    sendOK(avoidOn ? "ON" : "OFF");
  }
}
void hSpeed() {
  if (srv.hasArg("v")) {
    int s = srv.arg("v").toInt();
    if (s >= SPD_MIN && s <= SPD_MAX) {
      mSpd = s;
      sendOK("OK");
    }
  }
}
void hTrim() {
  if (srv.hasArg("l") && srv.hasArg("r")) {
    LTRIM = constrain(srv.arg("l").toFloat(), 0.5f, 1.0f);
    RTRIM = constrain(srv.arg("r").toFloat(), 0.5f, 1.0f);
    sendOK("OK");
  }
}
void hAD() {
  if (srv.hasArg("e")) {
    autoDisp = (srv.arg("e") == "1");
    sendOK(autoDisp ? "ON" : "OFF");
  }
}
void hTRF() {
  stopM();
  digitalWrite(RIN1, LOW);
  digitalWrite(RIN2, HIGH);
  digitalWrite(LIN1, LOW);
  digitalWrite(LIN2, LOW);
  rPWM(200);
  lPWM(0);
  curD = STOP;
  sendOK("RF");
}
void hTRB() {
  stopM();
  digitalWrite(RIN1, HIGH);
  digitalWrite(RIN2, LOW);
  digitalWrite(LIN1, LOW);
  digitalWrite(LIN2, LOW);
  rPWM(200);
  lPWM(0);
  curD = STOP;
  sendOK("RB");
}
void hTLF() {
  stopM();
  digitalWrite(RIN1, LOW);
  digitalWrite(RIN2, LOW);
  digitalWrite(LIN1, LOW);
  digitalWrite(LIN2, HIGH);
  rPWM(0);
  lPWM(200);
  curD = STOP;
  sendOK("LF");
}
void hTLB() {
  stopM();
  digitalWrite(RIN1, LOW);
  digitalWrite(RIN2, LOW);
  digitalWrite(LIN1, HIGH);
  digitalWrite(LIN2, LOW);
  rPWM(0);
  lPWM(200);
  curD = STOP;
  sendOK("LB");
}

// ========================== ROVER STATUS (for Python dispatch server)
// ==========================
void hRoverStatus() {
  const char *ms[] = {"IDLE",   "START", "PATH",   "HOME",
                      "ARRIVE", "SENSE", "UPLOAD", "GASFOLLOW",
                      "RETURN", "DONE",  "FAIL"};
  String state = "IDLE";
  if (miSt != MI_IDLE)
    state = "MISSION";
  else if (repOn)
    state = "BUSY";
  else if (hmOn)
    state = "BUSY";
  else if (scOn)
    state = "BUSY";

  char j[512]; // was 200 — overflowed if path name > ~60 chars, giving Python
               // server bad JSON
  snprintf(j, 512,
           "{\"state\":\"%s\",\"mission\":\"%s\",\"path\":\"%s\",\"rep\":%s,"
           "\"step\":%d,\"total\":%d}",
           state.c_str(), miSt < 11 ? ms[miSt] : "?", currentPathName.c_str(),
           repOn ? "true" : "false", cStep, sCnt);
  srv.sendHeader("Connection", "close");
  srv.send(200, "application/json", j);
}

// ========================== PUSH PATH (from Python server — NO Firebase call)
// ===========
void hPushPath() {
  if (miSt != MI_IDLE || repOn || hmOn) {
    srv.send(409, "text/plain", "Rover busy");
    return;
  }

  String body = srv.arg("plain");
  if (body.length() < 10) {
    srv.send(400, "text/plain", "No data");
    return;
  }

  Serial.printf("[PUSH] Received %d bytes\n", body.length());

  // Remove whitespace from body to make string matching reliable
  body.replace(" ", "");
  body.replace("\n", "");
  body.replace("\r", "");

  // Parse name
  int namePos = body.indexOf("\"name\":\"");
  String pathName = "pushed";
  if (namePos != -1) {
    int nameEnd = body.indexOf("\"", namePos + 8);
    if (nameEnd != -1)
      pathName = body.substring(namePos + 8, nameEnd);
  }

  // Parse count
  int countPos = body.indexOf("\"count\":");
  if (countPos == -1) {
    srv.send(400, "text/plain", "No count");
    return;
  }
  int countEnd = body.indexOf(",", countPos);
  if (countEnd == -1)
    countEnd = body.indexOf("}", countPos);
  int newCount = body.substring(countPos + 8, countEnd).toInt();

  if (newCount <= 0 || newCount > MAXST) {
    srv.send(400, "text/plain", "Bad count");
    return;
  }

  // Parse steps
  int stepsPos = body.indexOf("\"steps\":[");
  if (stepsPos == -1) {
    srv.send(400, "text/plain", "No steps in JSON");
    return;
  }

  sCnt = 0;
  int stepStart = stepsPos + 9;
  for (int i = 0; i < newCount && i < MAXST; i++) {
    int stepEnd = body.indexOf("}", stepStart);
    if (stepEnd == -1)
      break;

    String step = body.substring(stepStart, stepEnd + 1);

    int dirPos = step.indexOf("\"dir\":\"");
    if (dirPos != -1) {
      int dirEnd = step.indexOf("\"", dirPos + 7);
      String dir = step.substring(dirPos + 7, dirEnd);
      if (dir == "FWD")
        path[i].d = FWD;
      else if (dir == "BWD")
        path[i].d = BWD;
      else if (dir == "LEFT")
        path[i].d = LEFT;
      else if (dir == "RIGHT")
        path[i].d = RIGHT;
      else
        path[i].d = STOP;
    }

    int valPos = step.indexOf("\"val\":");
    if (valPos != -1) {
      int valEnd = step.indexOf(",", valPos);
      if (valEnd == -1)
        valEnd = step.indexOf("}", valPos);
      path[i].v = step.substring(valPos + 6, valEnd).toFloat();
    }

    int msPos = step.indexOf("\"ms\":");
    if (msPos != -1) {
      int msEnd = step.indexOf(",", msPos);
      if (msEnd == -1)
        msEnd = step.indexOf("}", msPos);
      path[i].ms = step.substring(msPos + 5, msEnd).toInt();
    }

    sCnt++;
    stepStart = stepEnd + 2;
  }

  currentPathName = pathName;
  Serial.printf("[PUSH] Loaded '%s' (%d steps) — starting replay\n",
                pathName.c_str(), sCnt);

  const char *dn[] = {"STOP", "FWD", "BWD", "LEFT", "RIGHT"};
  for (int i = 0; i < sCnt; i++) {
    Serial.printf("  %d: %s val=%.1f ms=%lu\n", i, dn[path[i].d], path[i].v,
                  path[i].ms);
  }

  // Start replay immediately
  // Send response FIRST then start
  srv.send(200, "text/plain", "OK");
  delay(10);
  revMode = false;
  beginRep();
}

// ========================== PATH MANAGEMENT ==========================

// Save current path LOCALLY (no Firebase needed — Python server handles upload)
void hSavePath() {
  if (!srv.hasArg("name")) {
    srv.send(400, "text/plain", "Missing name");
    return;
  }
  String pathName = srv.arg("name");
  pathName.trim();
  if (pathName.length() == 0 || pathName.length() > 30) {
    srv.send(400, "text/plain", "Invalid name");
    return;
  }
  if (sCnt == 0) {
    srv.send(400, "text/plain", "No path recorded");
    return;
  }

  currentPathName = pathName;
  savePath(); // Save to ESP32 flash (Preferences)
  Serial.printf("[PATH] Saved '%s' locally (%d steps)\n", pathName.c_str(),
                sCnt);
  srv.send(200, "text/plain", "OK");
}

// Return the current path as JSON (for Python server to read and upload to
// Firebase)
void hGetLocalPath() {
  const char *dn[] = {"STOP", "FWD", "BWD", "LEFT", "RIGHT"};
  String json = "{";
  json += "\"name\":\"" + currentPathName + "\",";
  json += "\"count\":" + String(sCnt) + ",";
  json += "\"pendingDelete\":\"" + pendingDeleteName +
          "\","; // poll thread checks this to delete from Firebase
  json += "\"steps\":[";
  for (int i = 0; i < sCnt; i++) {
    if (i > 0)
      json += ",";
    json += "{\"dir\":\"" + String(dn[path[i].d]) + "\",";
    json += "\"val\":" + String(path[i].v, 1) + ",";
    json += "\"ms\":" + String(path[i].ms) + "}";
  }
  json += "]}";
  srv.sendHeader("Connection", "close");
  srv.send(200, "application/json", json);
}

// Delete path from RAM + Flash and flag Python server to remove from Firebase
void hDeletePath() {
  String name = srv.hasArg("name") ? srv.arg("name") : currentPathName;
  name.trim();
  if (name.length() == 0) {
    srv.send(400, "text/plain", "No name");
    return;
  }

  pendingDeleteName = name; // server polls this and deletes from Firebase
  currentPathName = "";
  sCnt = 0;
  recOn = false;
  repOn = false;

  // Erase from flash (set cnt=0; loadPath() respects it)
  prefs.begin("path", false);
  prefs.putInt("cnt", 0);
  prefs.end();

  Serial.printf("[PATH] Deleted '%s' locally — awaiting Firebase removal\n",
                name.c_str());
  srv.send(200, "text/plain", "OK deleted: " + name);
}

// Called by Python server once Firebase delete is confirmed — clears the
// pending flag
void hClearDeleteFlag() {
  Serial.printf("[PATH] Firebase confirmed deletion of '%s'\n",
                pendingDeleteName.c_str());
  pendingDeleteName = "";
  srv.send(200, "text/plain", "OK");
}

// Return JSON array of saved path names — used by dashboard "Saved Paths" panel
void hGetPaths() {
  // ESP32 stores one path at a time locally. Python server manages Firebase
  // paths. Return the current in-memory path name, or empty array if nothing
  // recorded.
  String json = "[";
  if (sCnt > 0 && currentPathName.length() > 0) {
    json += "\"" + currentPathName + "\"";
  }
  json += "]";
  srv.sendHeader("Connection", "close");
  srv.send(200, "application/json", json);
}

// Start replay of the currently loaded path — used by dashboard "Saved Paths"
// click
void hPlayPath() {
  if (miSt != MI_IDLE || repOn || hmOn) {
    srv.send(409, "text/plain", "Rover busy");
    return;
  }
  if (sCnt == 0) {
    srv.send(404, "text/plain", "No path recorded — record one first");
    return;
  }
  // Send HTTP response FIRST (WebServer flushes on return), then start replay
  srv.send(200, "text/plain", "OK");
  delay(10);
  revMode = false;
  beginRep();
}

// ========================== SETUP ==========================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== AROHHAN ROVER FINAL ===");
  bootT = millis();
  pinMode(RIN1, OUTPUT);
  pinMode(RIN2, OUTPUT);
  pinMode(LIN1, OUTPUT);
  pinMode(LIN2, OUTPUT);
  setupPWM();
  pinMode(TRIG, OUTPUT);
  digitalWrite(TRIG, LOW);
  pinMode(ECHO, INPUT);
  pinMode(LENC, INPUT_PULLUP);
  pinMode(RENC, INPUT_PULLUP);
  pinMode(MQ2P, INPUT);
  pinMode(MQ135P, INPUT);
  dht.begin();
  pinMode(RGB_R, OUTPUT);
  pinMode(RGB_G, OUTPUT);
  pinMode(RGB_B, OUTPUT);
  setRGB(0, 1, 0); // start green
  stopM();
  for (int i = 0; i < DBF; i++)
    dBuf[i] = 999.0f;
  // ── WiFi AP + STA setup ─────────────────────────────────────────────────
  // IMPORTANT: ESP32 has ONE radio — AP and STA must share the same channel.
  // If the AP starts on channel 6 but STA connects to a router on channel 1,
  // the AP silently switches to channel 1.  Phones that were scanning ch 6
  // lose the AP for 30-60 s while they re-scan all channels.
  // FIX: scan for the home router FIRST, then start the AP on its channel.

  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);

  // Quick passive scan to find Airtel_Fearless's channel
  Serial.print("[WiFi] Scanning for home router channel...");
  int8_t homeChannel = 6;                              // fallback if not found
  int n = WiFi.scanNetworks(false, false, false, 150); // passive, 150 ms
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == String(STA_SSID)) {
      homeChannel = WiFi.channel(i);
      break;
    }
  }
  WiFi.scanDelete();
  Serial.printf(" using channel %d\n", homeChannel);

  // Start AP on the SAME channel the router uses — no switch will ever occur
  WiFi.softAP(AP_SSID, AP_PASS, homeChannel, 0, 4);
  Serial.printf("[WiFi] AP '%s' up on ch%d — IP 192.168.4.1\n", AP_SSID,
                homeChannel);

  // Start mDNS immediately on AP interface so arohan.local works right away
  if (MDNS.begin("arohan")) {
    Serial.println("[mDNS] arohan.local started on AP");
  }

  // Now connect STA to home network
  WiFi.begin(STA_SSID, STA_PASS);
  Serial.print("[WiFi] Connecting to Home WiFi: ");
  Serial.print(STA_SSID);

  // Wait briefly — don't block forever so AP keeps serving
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 10) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    staIP = WiFi.localIP().toString();
    Serial.printf("[WiFi] Connected! Home IP: %s\n", staIP.c_str());
    // Restart mDNS so it also advertises on the STA (home-network) interface
    MDNS.end();
    if (MDNS.begin("arohan")) {
      Serial.println("[mDNS] arohan.local restarted on STA+AP");
    }
  } else {
    Serial.println(
        "[WiFi] Home WiFi not reachable yet — AP still works on 192.168.4.1");
  }

  delay(200);
  Serial.printf("[WiFi] AP-IP: 192.168.4.1 | Home-IP: %s\n",
                staIP.length() > 0 ? staIP.c_str() : "None");

  // Path management routes (local only — no Firebase from ESP32)
  srv.on("/savepath", HTTP_GET, hSavePath);
  srv.on("/getlocalpath", HTTP_GET, hGetLocalPath);
  srv.on("/pushpath", HTTP_POST, hPushPath);
  srv.on("/rstatus", HTTP_GET, hRoverStatus);
  srv.on("/runreverse", HTTP_GET, hRunRev);
  srv.on("/getpaths", HTTP_GET, hGetPaths); // dashboard Saved Paths list
  srv.on("/playpath", HTTP_GET,
         hPlayPath); // dashboard Saved Paths click-to-play
  srv.on("/deletepath", HTTP_GET, hDeletePath); // dashboard ✕ delete button
  srv.on("/cleardeleteflag", HTTP_GET,
         hClearDeleteFlag); // Python server calls after Firebase delete

  srv.on("/", HTTP_GET, hRoot);
  srv.on("/forward", HTTP_GET, hFwd);
  srv.on("/backward", HTTP_GET, hBwd);
  srv.on("/left", HTTP_GET, hLft);
  srv.on("/right", HTTP_GET, hRgt);
  srv.on("/stop", HTTP_GET, hStp);
  srv.on("/sensors", HTTP_GET, hSens);
  srv.on("/avoid", HTTP_GET, hAvoid);
  srv.on("/record", HTTP_GET, hRec);
  srv.on("/stoprecord", HTTP_GET, hSRec);
  srv.on("/run", HTTP_GET, hRun);
  srv.on("/stopreplay", HTTP_GET, hSRun);
  srv.on("/speed", HTTP_GET, hSpeed);
  srv.on("/trim", HTTP_GET, hTrim);
  srv.on("/trf", HTTP_GET, hTRF);
  srv.on("/trb", HTTP_GET, hTRB);
  srv.on("/tlf", HTTP_GET, hTLF);
  srv.on("/tlb", HTTP_GET, hTLB);
  srv.on("/home", HTTP_GET, hHm);
  srv.on("/stophome", HTTP_GET, hSHm);
  srv.on("/mission", HTTP_GET, hMi);
  srv.on("/stopmission", HTTP_GET, hSMi);
  srv.on("/autodisp", HTTP_GET, hAD);
  srv.on("/startgas", HTTP_GET, hGasFollow);
  srv.begin();

  NimBLEDevice::init("Arohhan_Rover");
  NimBLEServer *ps = NimBLEDevice::createServer();
  ps->setCallbacks(new SrvCB());
  NimBLEService *sv = ps->createService(BLE_SVC);
  pChr = sv->createCharacteristic(BLE_CHR, NIMBLE_PROPERTY::READ |
                                               NIMBLE_PROPERTY::WRITE);
  pChr->setCallbacks(new ChrCB());
  pChr->setValue("OK");
  sv->start();
  NimBLEDevice::getAdvertising()->addServiceUUID(BLE_SVC);
  NimBLEDevice::getAdvertising()->start();

  // ── I2C + MPU6050 FORCE WAKE ─────────────────────────────────
  Wire.begin(21, 22);
  Wire.setTimeOut(10); // FIX: Prevent infinite I2C hang from motor EMI noise!
  delay(100);

  // Scan for I2C devices
  Serial.println("[I2C] Scanning...");
  int foundAddr = -1;
  for (int addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("[I2C] Found device at 0x%02X\n", addr);
      if (addr == 0x68 || addr == 0x69)
        foundAddr = addr;
    }
  }

  if (foundAddr == -1) {
    Serial.println("[I2C] NO DEVICES FOUND!");
    mpuOK = false;
  } else {
    Serial.printf("[I2C] MPU6050 at 0x%02X\n", foundAddr);

    // ── MANUAL WAKE UP (fixes clone chips) ──────────────────
    // Write 0x00 to PWR_MGMT_1 (register 0x6B) to wake from sleep
    Wire.beginTransmission(0x68);
    Wire.write(0x6B); // PWR_MGMT_1 register
    Wire.write(0x00); // Clear sleep bit (wake up)
    Wire.endTransmission(true);
    delay(100);

    // Reset gyro/accel signal paths
    Wire.beginTransmission(0x68);
    Wire.write(0x68); // SIGNAL_PATH_RESET
    Wire.write(0x07); // Reset all
    Wire.endTransmission(true);
    delay(100);

    // Read WHO_AM_I to see what chip reports
    Wire.beginTransmission(0x68);
    Wire.write(0x75); // WHO_AM_I register
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)0x68, (uint8_t)1, (uint8_t)true);
    uint8_t whoami = Wire.read();
    Serial.printf("[MPU] WHO_AM_I = 0x%02X\n", whoami);

    // Initialize library
    imu.initialize();
    delay(100);

    // Wake up AGAIN after library init (library might reset it)
    Wire.beginTransmission(0x68);
    Wire.write(0x6B);
    Wire.write(0x00);
    Wire.endTransmission(true);
    delay(50);

    // Try reading raw gyro
    int16_t gx, gy, gz;
    imu.getRotation(&gx, &gy, &gz);
    Serial.printf("[MPU] Raw gyro: X=%d Y=%d Z=%d\n", gx, gy, gz);

    // Check if readings are valid (not all zeros)
    bool hasData = (gx != 0 || gy != 0 || gz != 0);
    bool testOK = imu.testConnection();

    Serial.printf("[MPU] testConnection=%s hasData=%s\n", testOK ? "YES" : "NO",
                  hasData ? "YES" : "NO");

    // Accept if EITHER test passes
    if (testOK || hasData) {
      mpuOK = true;
      calGyro();
      ang = 0;
      Serial.println("[MPU] OK — Gyro ready!");
    } else {
      // Force enable anyway - some chips work despite failing tests
      Serial.println("[MPU] Tests failed, forcing enable...");
      mpuOK = true;

      // Try calibration anyway
      delay(500);
      float sum = 0;
      bool gotData = false;
      for (int i = 0; i < 100; i++) {
        imu.getRotation(&gx, &gy, &gz);
        if (gz != 0)
          gotData = true;
        sum += gz / 131.0f;
        delay(5);
      }
      gBiasZ = sum / 100.0f;
      Serial.printf("[MPU] Forced calibration: bias=%.2f gotData=%s\n", gBiasZ,
                    gotData ? "YES" : "NO");

      if (!gotData) {
        Serial.println("[MPU] NO DATA - chip is dead");
        mpuOK = false;
      }
      ang = 0;
    }
  }

  if (!mpuOK) {
    Serial.println("[MPU] FAILED — turns will use TIME ONLY");
  }

  // MQ2 FORCE TEST
  Serial.println("[MQ2 TEST] Reading 10 samples:");
  for (int i = 0; i < 10; i++) {
    int raw = analogRead(34);
    float voltage = raw * (3.3f / 4095.0f);
    Serial.printf("  Sample %d: raw=%d  voltage=%.3fV\n", i, raw, voltage);
    delay(500);
  }

  attachInterrupt(digitalPinToInterrupt(LENC), iL, CHANGE);
  attachInterrupt(digitalPinToInterrupt(RENC), iR, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ECHO), iE, CHANGE);
  lastGyro = millis();

  loadPath();

  // DISABLED: Firebase task crashes on this ESP32 Arduino core version (LWIP
  // lock bug) Everything else works — dashboard, motors, recording, replay,
  // paths xTaskCreatePinnedToCore(fbTask, "FB", 12288, NULL, 1, NULL, 1);
  Serial.println(
      "[FB] Firebase task DISABLED (LWIP fix — use Python server instead)");

  Serial.printf("[READY] Heap=%d Steps=%d\n", (int)ESP.getFreeHeap(), sCnt);
  Serial.println("Dashboard: http://192.168.4.1");
  Serial.println("IMPORTANT: Re-record path after flashing.");
}

// ========================== LOOP ==========================

// STA reconnect — runs every 30 s so a temporary drop doesn't kill arohan.local
unsigned long lastStaCheck = 0;
void maintainSTA() {
  unsigned long now = millis();
  if (now - lastStaCheck < 30000)
    return;
  lastStaCheck = now;

  if (WiFi.status() == WL_CONNECTED)
    return; // all good

  Serial.println("[WiFi] STA dropped — reconnecting...");
  WiFi.disconnect(false);
  delay(100);
  WiFi.begin(STA_SSID, STA_PASS);

  // Give it up to 5 s without blocking the main loop
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 5000) {
    delay(200);
  }

  if (WiFi.status() == WL_CONNECTED) {
    staIP = WiFi.localIP().toString();
    Serial.printf("[WiFi] Reconnected! IP: %s\n", staIP.c_str());
    MDNS.end();
    if (MDNS.begin("arohan")) {
      Serial.println("[mDNS] arohan.local restarted");
    }
  } else {
    Serial.println("[WiFi] Still unreachable — AP running on 192.168.4.1");
  }
}

void loop() {
  srv.handleClient();
  updBoost();
  updWatchdog();
  updRGB();
  updUS();
  updGyro();
  unsigned long now = millis();
  if (now - lastGas >= 200) {
    lastGas = now;
    rdGas();
    rdDHT();
    updOdom();
  }

  // Keep home-WiFi connection alive (only when rover is not moving)
  if (!repOn && !hmOn && !scOn)
    maintainSTA();

  if (avoidOn && !hmOn && !scOn) {
    if (!repOn || (repOn && curD == FWD))
      doAvoid();
  }

  if (repOn)
    doReplay();
  if (hmOn)
    doHome();
  if (scOn)
    doScan();
  doMission();
}

// ========================== HTML ==========================
const char HTML_PAGE[] PROGMEM = R"rawhtml(
<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Arohhan FINAL</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{font-family:sans-serif;background:#667eea;padding:8px;user-select:none;
     -webkit-user-select:none;-moz-user-select:none;-ms-user-select:none}
.c{max-width:460px;margin:0 auto;background:#fff;border-radius:14px;padding:14px}
h2{text-align:center;color:#4a5568;margin-bottom:8px;font-size:1.2rem}
.p{background:#f7fafc;padding:8px;border-radius:8px;margin-bottom:6px;font-size:.8rem;border-left:3px solid #4299e1}
.row{display:flex;justify-content:space-between;margin-bottom:3px}
.v{font-weight:bold}
.sr{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:.8rem;justify-content:center}
.sr input{width:110px}
.tw{display:flex;justify-content:space-between;align-items:center;background:#f7fafc;padding:6px 10px;border-radius:8px;margin-bottom:5px;font-size:.8rem}
.sw{position:relative;width:40px;height:22px;display:inline-block}
.sw input{opacity:0;width:0;height:0}
.sk{position:absolute;cursor:pointer;inset:0;background:#ccc;border-radius:22px;transition:.3s}
.sk:before{position:absolute;content:"";height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s}
input:checked+.sk{background:#48bb78}
input:checked+.sk:before{transform:translateX(18px)}
.ms{text-align:center;margin-bottom:6px}
.m{padding:7px 12px;border:none;border-radius:14px;font-size:.75rem;font-weight:bold;cursor:pointer;margin:2px;color:#fff}
.g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px}
.b{padding:18px 10px;border:none;border-radius:10px;font-size:1rem;font-weight:bold;cursor:pointer;color:#fff;
   touch-action:manipulation;transition:filter .1s;
   -webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
.b:active,.b.held{filter:brightness(0.75)}
.bf{grid-column:2;grid-row:1;background:#48bb78}
.bl{grid-column:1;grid-row:2;background:#4299e1}
.bs{grid-column:2;grid-row:2;background:#e53e3e}
.br{grid-column:3;grid-row:2;background:#4299e1}
.bb{grid-column:2;grid-row:3;background:#ed8936}
.hint{text-align:center;font-size:.65rem;color:#999;margin-bottom:6px}
.t{background:#f0f0ff;padding:6px;border-radius:8px;margin-bottom:6px;text-align:center;font-size:.7rem}
.tb{padding:4px 8px;border:none;border-radius:6px;font-size:.7rem;cursor:pointer;margin:2px;color:#fff;background:#667eea}
.hm{background:#edf2f7;padding:8px;border-radius:8px;margin-bottom:6px;font-size:.8rem}
.f{text-align:center;color:#999;font-size:.65rem;margin-top:6px}
.d{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px}
.do{background:#48bb78}.dm{background:#ed8936}.ds{background:#e53e3e}
.cl{background:#f7fafc;padding:5px 8px;border-radius:8px;margin-bottom:6px;font-size:.7rem}
.cl label{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
.cl input{width:80px}
.rp{background:#ebf8ff;padding:6px 10px;border-radius:8px;margin-bottom:6px;font-size:.75rem;display:none;border-left:3px solid #4299e1}
.mp{background:#f0fff4;padding:8px;border-radius:8px;margin-bottom:6px;font-size:.8rem;border-left:3px solid #38a169;display:none}

/* Modal styles */
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center}
.modal.show{display:flex}
.modal-box{background:#fff;padding:20px;border-radius:12px;width:90%;max-width:320px;text-align:center}
.modal-box h3{margin-bottom:15px;color:#4a5568}
.modal-box input{width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:1rem;margin-bottom:15px}
.modal-box input:focus{outline:none;border-color:#4299e1}
.modal-btn{padding:10px 20px;border:none;border-radius:8px;font-size:.9rem;font-weight:bold;cursor:pointer;margin:0 5px}
.modal-save{background:#48bb78;color:#fff}
.modal-cancel{background:#e2e8f0;color:#4a5568}

/* Saved paths section */
.paths{background:#f0f4ff;padding:10px;border-radius:8px;margin-bottom:6px}
.paths h4{font-size:.8rem;color:#4a5568;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
.paths-list{display:flex;flex-wrap:wrap;gap:6px}
.path-item{background:#667eea;color:#fff;padding:6px 12px;border-radius:20px;font-size:.75rem;cursor:pointer;display:flex;align-items:center;gap:6px}
.path-item:hover{background:#5a67d8}
.path-item .del{background:rgba(255,255,255,0.3);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:.6rem}
.path-item .del:hover{background:rgba(255,0,0,0.5)}
.no-paths{color:#999;font-size:.75rem;font-style:italic}
.refresh-btn{background:#4299e1;color:#fff;border:none;padding:3px 8px;border-radius:4px;font-size:.65rem;cursor:pointer}
</style></head><body>
<div class="c">
<h2>Arohhan Rover — Final</h2>
<div class="mp" id="mp"><b>Mission:</b> <span id="mSt">IDLE</span><br><span id="mMs"></span></div>
<div class="p">
<div class="row"><span>Distance:</span><span class="v" id="ds">--</span></div>
<div class="row"><span>Travelled:</span><span class="v" id="td">--</span></div>
<div class="row"><span>Angle:</span><span class="v" id="an">--</span></div>
<div class="row"><span>MQ2:</span><span class="v" id="g2">--</span></div>
<div class="row"><span>MQ135:</span><span class="v" id="g1">--</span></div>
<div class="row"><span>Flame:</span><span class="v" id="fl">--</span></div>
<div class="row"><span>Status:</span><span id="st"><span class="d do"></span>Ready</span></div>
<div class="row"><span>Steps:</span><span class="v" id="sp">0</span></div>
<div class="row"><span>WiFi:</span><span class="v" id="wf">--</span></div>
<div class="row"><span>Turn Debug:</span><span class="v" id="tdbg" style="font-size:.65rem;color:#e53e3e">--</span></div>
</div>
<div class="rp" id="ri"></div>

<!-- Saved Paths Section -->
<div class="paths">
<h4>Saved Paths <button class="refresh-btn" onclick="loadPaths()">↻ Refresh</button></h4>
<div class="paths-list" id="pathsList"><span class="no-paths">Loading...</span></div>
</div>

<div class="tw"><span>Auto Dispatch</span><label class="sw"><input type="checkbox" id="adE" onchange="tAD()"><span class="sk"></span></label></div>
<div class="ms">
<button class="m" style="background:#38a169" onclick="fetch('/mission')">Dispatch</button>
<button class="m" style="background:#e53e3e" onclick="fetch('/stopmission')">Stop Mission</button>
</div>
<div class="tw"><span>Obstacle Avoid</span><label class="sw"><input type="checkbox" id="av" onchange="ta()"><span class="sk"></span></label></div>
<div class="sr"><span>Speed:</span><input type="range" id="sR" min="140" max="220" value="180" oninput="ss(this.value)"><span id="sV">180</span></div>
<div class="cl">
<label>L Trim: <span id="lV">100</span>%<input type="range" id="lR" min="50" max="100" value="100" oninput="stm()"></label>
<label>R Trim: <span id="rV">100</span>%<input type="range" id="rR" min="50" max="100" value="100" oninput="stm()"></label>
</div>
<div class="ms">
<button class="m" style="background:#e53e3e" id="rb" onclick="tr()">Record</button>
<button class="m" style="background:#4299e1" id="pb" onclick="tp()">Run</button>
<button class="m" style="background:#805ad5" id="hb" onclick="th()">Home</button>
</div>

<p class="hint">Hold button to move — release to stop</p>
<div class="g">
<button class="b bf" id="bF">&#9650; FWD</button>
<button class="b bl" id="bL">&#9664; LEFT</button>
<button class="b bs" id="bS">&#9632; STOP</button>
<button class="b br" id="bR">RIGHT &#9654;</button>
<button class="b bb" id="bB">&#9660; BWD</button>
</div>

<div class="hm" id="hm" style="display:none">
<b>Homing</b><br>State: <span id="hS">--</span> | Cycles: <span id="hC">0</span><br>
RSSI: <span id="hR">--</span> | Node: <span id="hN">--</span><br><span id="hG">--</span>
</div>
<div class="t"><b>Motor Test</b><br>
<button class="tb" onclick="fetch('/trf')">RF</button>
<button class="tb" onclick="fetch('/trb')">RB</button>
<button class="tb" onclick="fetch('/tlf')">LF</button>
<button class="tb" onclick="fetch('/tlb')">LB</button>
<button class="tb" onclick="fetch('/stop')" style="background:#e53e3e">STOP</button>
</div>
<div class="f">AP: 192.168.4.1 | STA: <span id="ip">--</span> | Heap: <span id="hp">--</span></div>
</div>

<!-- Save Path Modal -->
<div class="modal" id="saveModal">
<div class="modal-box">
<h3>Save Path</h3>
<input type="text" id="pathNameInput" placeholder="Enter path name..." maxlength="30">
<div>
<button class="modal-btn modal-cancel" onclick="closeModal()">Cancel</button>
<button class="modal-btn modal-save" onclick="savePath()">Save</button>
</div>
</div>
</div>

<script>
var rc=0,rn=0,hm=0,curHold=null,holdInterval=null;

// ── MODAL FUNCTIONS ──────────────────────────────────────
function showSaveModal(){
    document.getElementById('saveModal').classList.add('show');
    document.getElementById('pathNameInput').value='';
    document.getElementById('pathNameInput').focus();
}
function closeModal(){
    document.getElementById('saveModal').classList.remove('show');
}
function savePath(){
    var name=document.getElementById('pathNameInput').value.trim();
    if(!name){alert('Please enter a path name');return;}
    fetch('/savepath?name='+encodeURIComponent(name))
    .then(function(r){
        if(r.ok){
            closeModal();
            loadPaths();
            alert('Path "'+name+'" saved!');
        }else{
            r.text().then(function(t){alert('Error: '+t);});
        }
    })
    .catch(function(){alert('Save failed');});
}

// ── SAVED PATHS ──────────────────────────────────────────
function loadPaths(){
    var list=document.getElementById('pathsList');
    list.innerHTML='<span class="no-paths">Loading...</span>';
    fetch('/getpaths')
    .then(function(r){return r.json();})
    .then(function(paths){
        if(!paths||paths.length===0){
            list.innerHTML='<span class="no-paths">No saved paths</span>';
            return;
        }
        list.innerHTML='';
        paths.forEach(function(name){
            var item=document.createElement('div');
            item.className='path-item';
            item.innerHTML='<span onclick="playPath(\''+name+'\')">'+name+'</span><span class="del" onclick="deletePath(event,\''+name+'\')">✕</span>';
            list.appendChild(item);
        });
    })
    .catch(function(){
        list.innerHTML='<span class="no-paths">Failed to load</span>';
    });
}
function playPath(name){
    if(confirm('Play path "'+name+'"?')){
        fetch('/playpath?name='+encodeURIComponent(name))
        .then(function(r){
            if(r.ok){
                rn=1;
                var b=document.getElementById('pb');
                b.textContent='Stop';
                b.style.background='#718096';
            }else{
                r.text().then(function(t){alert('Error: '+t);});
            }
        });
    }
}
function deletePath(e,name){
    e.stopPropagation();
    if(confirm('Delete path "'+name+'"?')){
        fetch('/deletepath?name='+encodeURIComponent(name))
        .then(function(r){
            if(r.ok)loadPaths();
            else alert('Delete failed');
        });
    }
}

// ── HOLD-TO-MOVE ──────────────────────────────────────────
function hold(dir,e){
    if(e){e.preventDefault();e.stopPropagation();}
    if(curHold===dir)return;
    curHold=dir;
    fetch('/'+dir);
    // ── REPEAT COMMAND WHILE HELD ──────────────────────────
    holdInterval=setInterval(function(){
        if(curHold===dir) fetch('/'+dir);
    },400);
    // ───────────────────────────────────────────────────────
    ['bF','bB','bL','bR'].forEach(function(id){
        document.getElementById(id).classList.remove('held');
    });
    var map={forward:'bF',backward:'bB',left:'bL',right:'bR'};
    if(map[dir])document.getElementById(map[dir]).classList.add('held');
}
function rel(e){
    if(e){e.preventDefault();e.stopPropagation();}
    if(!curHold)return;
     clearInterval(holdInterval);
    curHold=null;
    fetch('/stop');
    ['bF','bB','bL','bR'].forEach(function(id){
        document.getElementById(id).classList.remove('held');
    });
}

document.addEventListener('DOMContentLoaded',function(){
    var btns=[
        {id:'bF',dir:'forward'},
        {id:'bB',dir:'backward'},
        {id:'bL',dir:'left'},
        {id:'bR',dir:'right'}
    ];
    btns.forEach(function(b){
        var el=document.getElementById(b.id);
        el.addEventListener('touchstart',function(e){hold(b.dir,e);},false);
        el.addEventListener('touchend',function(e){rel(e);},false);
        el.addEventListener('touchcancel',function(e){rel(e);},false);
        el.addEventListener('mousedown',function(e){hold(b.dir,e);},false);
        el.addEventListener('mouseup',function(e){rel(e);},false);
        el.addEventListener('mouseleave',function(e){rel(e);},false);
        el.addEventListener('contextmenu',function(e){e.preventDefault();return false;},false);
    });
    var stopBtn=document.getElementById('bS');
    stopBtn.addEventListener('touchstart',function(e){e.preventDefault();fetch('/stop');},false);
    stopBtn.addEventListener('click',function(e){e.preventDefault();fetch('/stop');},false);
    stopBtn.addEventListener('contextmenu',function(e){e.preventDefault();return false;},false);
    
    // Load saved paths on startup
    loadPaths();
});

window.addEventListener('blur',rel);
document.addEventListener('visibilitychange',function(){if(document.hidden)rel();});
document.addEventListener('selectstart',function(e){
    if(e.target.classList.contains('b'))e.preventDefault();
});

function ta(){fetch('/avoid?e='+(document.getElementById('av').checked?'1':'0'));}
function ss(v){document.getElementById('sV').textContent=v;fetch('/speed?v='+v);}
function stm(){
    var l=document.getElementById('lR').value,r=document.getElementById('rR').value;
    document.getElementById('lV').textContent=l;document.getElementById('rV').textContent=r;
    fetch('/trim?l='+(l/100)+'&r='+(r/100));
}
function tAD(){fetch('/autodisp?e='+(document.getElementById('adE').checked?'1':'0'));}

// Modified record toggle - shows modal on stop
function tr(){
    if(!rc){
        fetch('/record').then(function(){
            rc=1;
            var b=document.getElementById('rb');
            b.textContent='Stop Rec';
            b.style.background='#718096';
        });
    }else{
        fetch('/stoprecord').then(function(){
            rc=0;
            var b=document.getElementById('rb');
            b.textContent='Record';
            b.style.background='#e53e3e';
            // Show save dialog
            showSaveModal();
        });
    }
}
function tp(){
    if(!rn){fetch('/run').then(function(){rn=1;var b=document.getElementById('pb');b.textContent='Stop';b.style.background='#718096';})}
    else{fetch('/stopreplay').then(function(){rn=0;var b=document.getElementById('pb');b.textContent='Run';b.style.background='#4299e1';})}
}
function th(){
    if(!hm){fetch('/home').then(function(){hm=1;var b=document.getElementById('hb');b.textContent='Stop';b.style.background='#718096';})}
    else{fetch('/stophome').then(function(){hm=0;var b=document.getElementById('hb');b.textContent='Home';b.style.background='#805ad5';})}
}

function pl(){
    fetch('/sensors').then(function(r){return r.json();}).then(function(d){
        document.getElementById('ds').textContent=d.dist.toFixed(1)+' cm';
        document.getElementById('td').textContent=d.total.toFixed(1)+' cm';
        document.getElementById('an').textContent=d.angle.toFixed(1)+'\u00B0';
        document.getElementById('g2').textContent=d.mq2;
        document.getElementById('g1').textContent=d.mq135;
        document.getElementById('fl').textContent=d.flame==0?'CLEAR':'DETECTED';
        document.getElementById('sp').textContent=d.steps;
        document.getElementById('hp').textContent=d.heap;
        document.getElementById('ip').textContent=d.staIP||'--';
        document.getElementById('av').checked=d.av;
        document.getElementById('adE').checked=d.ad;
        document.getElementById('wf').innerHTML=d.staC?
            '<span class="d do"></span>'+d.staIP:
            '<span class="d ds"></span>Offline';
        document.getElementById('tdbg').textContent=d.tdbg||'--';
        var ri=document.getElementById('ri');
        if(d.rep){
            ri.style.display='block';
            ri.textContent=(d.rev?'Returning':'Replaying')+' step '+(d.rpCur+1)+'/'+d.steps;
        }else ri.style.display='none';
        var mp=document.getElementById('mp');
        if(d.ms!='IDLE'){mp.style.display='block';document.getElementById('mSt').textContent=d.ms;document.getElementById('mMs').textContent=d.msMsg;}
        else mp.style.display='none';
        document.getElementById('hm').style.display=d.homing?'block':'none';
        document.getElementById('hS').textContent=d.hSt;
        document.getElementById('hC').textContent=d.hCyc;
        document.getElementById('hR').textContent=d.rssi;
        document.getElementById('hN').textContent=d.node||'--';
        document.getElementById('hG').textContent=d.hMsg;
        var st=document.getElementById('st');
        if(d.ms!='IDLE')st.innerHTML='<span class="d dm"></span>Mission: '+d.ms;
        else if(d.rep)st.innerHTML='<span class="d dm"></span>'+(d.rev?'Returning':'Replaying');
        else if(d.rec)st.innerHTML='<span class="d dm"></span>Recording';
        else if(d.homing)st.innerHTML='<span class="d dm"></span>Homing';
        else if(d.mov)st.innerHTML='<span class="d do"></span>Moving: '+d.dir;
        else st.innerHTML='<span class="d do"></span>Ready';
        if(d.rec&&!rc){rc=1;var b=document.getElementById('rb');b.textContent='Stop Rec';b.style.background='#718096';}
        if(!d.rec&&rc){rc=0;var b=document.getElementById('rb');b.textContent='Record';b.style.background='#e53e3e';}
        if(d.rep&&!rn){rn=1;var b=document.getElementById('pb');b.textContent='Stop';b.style.background='#718096';}
        if(!d.rep&&rn){rn=0;var b=document.getElementById('pb');b.textContent='Run';b.style.background='#4299e1';}
        if(d.homing&&!hm){hm=1;var b=document.getElementById('hb');b.textContent='Stop';b.style.background='#718096';}
        if(!d.homing&&hm){hm=0;var b=document.getElementById('hb');b.textContent='Home';b.style.background='#805ad5';}
    }).catch(function(){});
}
setInterval(pl,1000);pl();
</script>
</body></html>
)rawhtml";