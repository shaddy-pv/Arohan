#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverName = "http://YOUR_BACKEND_IP:5000/api/sensors/data";

const int gasPin = 34; // Analog pin
const int tempPin = 35; // Analog pin

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  while(WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
}

void loop() {
  if(WiFi.status() == WL_CONNECTED){
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    int gasValue = analogRead(gasPin);
    int tempValue = analogRead(tempPin);

    // Build JSON payload manually for simplicity
    String httpRequestData = "{\"nodeId\":\"ESP-ZoneA\", \"gasLevel\":\"" + String(gasValue) + "\", \"temperature\":\"" + String(tempValue) + "\"}";
    
    int httpResponseCode = http.POST(httpRequestData);
    
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    
    http.end();
  }
  delay(5000); // Send data every 5 seconds
}
