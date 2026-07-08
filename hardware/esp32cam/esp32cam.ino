/* =================================================================
 *  AROHAN ESP32-CAM — OPTIMIZED FOR WEAK WIFI
 *  Board: AI Thinker ESP32-CAM
 *  Partition: Huge APP (3MB No OTA/1MB SPIFFS)
 *  PSRAM: Enabled (CRITICAL!)
 * ================================================================= */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_timer.h"
#include "img_converters.h"
#include "fb_gfx.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ========================== WIFI CONFIG ==========================
const char* ssid     = "Airtel_Fearless";
const char* password = "Fearless@1234";

// ========================== CAMERA PINS (AI-Thinker) ==========================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define LED_GPIO_NUM       4

WiFiServer server(81);
bool cameraOK = false;

void setupCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode    = CAMERA_GRAB_LATEST;

  if (psramFound()) {
    Serial.println("[CAM] PSRAM OK");
    config.frame_size   = FRAMESIZE_VGA;   // 640x480 — clean & sharp
    config.jpeg_quality = 10;              // best quality
    config.fb_count     = 2;
    config.fb_location  = CAMERA_FB_IN_PSRAM;
  } else {
    Serial.println("[CAM] No PSRAM");
    config.frame_size   = FRAMESIZE_QVGA;
    config.jpeg_quality = 18;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] FAIL: 0x%x\n", err);
    cameraOK = false;
    return;
  }

  sensor_t* s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_brightness(s, 1);
    s->set_contrast(s, 1);
    s->set_saturation(s, 0);
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_aec2(s, 1);
    s->set_ae_level(s, 0);
    s->set_gain_ctrl(s, 1);
    s->set_agc_gain(s, 0);
    s->set_gainceiling(s, (gainceiling_t)6);  // better low-light
    s->set_bpc(s, 1);
    s->set_wpc(s, 1);
    s->set_raw_gma(s, 1);
    s->set_lenc(s, 1);
    s->set_hmirror(s, 0);
    s->set_vflip(s, 0);
    s->set_dcw(s, 1);
  }

  cameraOK = true;
  Serial.println("[CAM] Ready!");
}

void handleStream(WiFiClient& client) {
  camera_fb_t* fb = NULL;

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
  client.println("Access-Control-Allow-Origin: *");
  client.println();

  Serial.println("[STREAM] Client connected");

  unsigned long lastFrame = millis();
  int frameCount = 0;

  while (client.connected()) {
    fb = esp_camera_fb_get();
    if (!fb) { delay(50); continue; }

    client.printf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", fb->len);
    size_t sent = client.write(fb->buf, fb->len);
    client.print("\r\n");
    esp_camera_fb_return(fb);

    if (sent == 0) break;  // Client disconnected mid-stream

    frameCount++;
    if (frameCount >= 30) {
      float fps = 30000.0f / (millis() - lastFrame);
      Serial.printf("[STREAM] FPS: %.1f\n", fps);
      lastFrame  = millis();
      frameCount = 0;
    }

    delay(40); // ~20 FPS — smooth and stable
  }

  Serial.println("[STREAM] Client disconnected");
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  Serial.begin(115200);
  Serial.println("\n=== AROHAN ESP32-CAM ===");

  pinMode(LED_GPIO_NUM, OUTPUT);
  digitalWrite(LED_GPIO_NUM, LOW);

  setupCamera();
  if (!cameraOK) {
    Serial.println("[FATAL] Camera failed");
    while (1) { delay(1000); }
  }

  Serial.printf("[WiFi] Connecting to %s", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);  // Max TX power for weak WiFi range
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WiFi] Connected!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WiFi] Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("[WiFi] FAILED!");
  }

  server.begin();
  Serial.println("\n=== READY ===");
  Serial.print("Stream URL: http://");
  Serial.print(WiFi.localIP());
  Serial.println(":81/stream");

  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_GPIO_NUM, HIGH); delay(100);
    digitalWrite(LED_GPIO_NUM, LOW);  delay(100);
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect > 5000) {
      Serial.println("[WiFi] Reconnecting...");
      WiFi.reconnect();
      lastReconnect = millis();
    }
    return;
  }

  WiFiClient client = server.available();
  if (!client) { delay(5); return; }

  Serial.println("[SERVER] New connection");
  String req = "";
  unsigned long timeout = millis() + 2000;

  while (client.connected() && millis() < timeout) {
    if (client.available()) {
      char c = client.read();
      req += c;
      if (req.endsWith("\r\n\r\n")) break;
    }
  }

  if (req.indexOf("GET /stream") >= 0) {
    handleStream(client);
  }
  else if (req.indexOf("GET /capture") >= 0) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) {
      client.println("HTTP/1.1 200 OK");
      client.println("Content-Type: image/jpeg");
      client.println("Access-Control-Allow-Origin: *");
      client.printf("Content-Length: %d\r\n", fb->len);
      client.println("Cache-Control: no-cache");
      client.println();
      client.write(fb->buf, fb->len);
      esp_camera_fb_return(fb);
    } else {
      client.println("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    }
  }
  else if (req.indexOf("GET /status") >= 0) {
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Access-Control-Allow-Origin: *");
    client.println();
    client.printf("{\"cam\":true,\"ip\":\"%s\",\"rssi\":%d,\"heap\":%d}",
      WiFi.localIP().toString().c_str(),
      WiFi.RSSI(),
      (int)ESP.getFreeHeap());
  }
  else {
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: text/html");
    client.println();
    client.println("<html><body style='background:#667eea;color:#fff;padding:20px'>");
    client.println("<h1>AROHAN ESP32-CAM</h1>");
    client.print("<p>Stream: <a href='/stream' style='color:#fff'>http://");
    client.print(WiFi.localIP());
    client.println(":81/stream</a></p>");
    client.println("<p>Capture: <a href='/capture' style='color:#fff'>/capture</a></p>");
    client.println("<p>Status: <a href='/status' style='color:#fff'>/status</a></p>");
    client.println("</body></html>");
  }

  client.stop();
}