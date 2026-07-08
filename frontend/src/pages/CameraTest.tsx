import React from 'react';
import { Sidebar } from '@/components/Sidebar';
import { SimpleMjpegStream } from '@/components/SimpleMjpegStream';
import { Card } from '@/components/ui/card';

const CameraTest: React.FC = () => {

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 overflow-auto bg-background">
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-8 py-4">
          <h1 className="text-2xl font-bold">Camera Test</h1>
          <p className="text-sm text-muted-foreground">ESP32-CAM integration testing</p>
        </header>

        <div className="p-4 sm:p-8">
          {/* ESP32-CAM Stream Component */}
          <div className="max-w-5xl mx-auto">
            <SimpleMjpegStream
              streamUrl={`${import.meta.env.VITE_ESP32_BASE_URL || 'http://192.168.137.247:81'}/stream`}
              nodeId="test-node"
              roverId="test-rover"
              showControls={true}
              onSnapshotSaved={(metadata) => {
                // Snapshot saved
              }}
            />
          </div>

          {/* Quick Actions */}
          <div className="mt-6 max-w-5xl mx-auto">
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Stream Controls:</strong>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    <li>• Click "Start Stream" to begin</li>
                    <li>• Click "Stop Stream" to end</li>
                    <li>• "Test Connection" verifies ESP32-CAM</li>
                  </ul>
                </div>
                <div>
                  <strong>Snapshot Features:</strong>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    <li>• "Save Snapshot" uploads to Firebase</li>
                    <li>• "Download" saves locally</li>
                    <li>• Recent snapshots shown below video</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>

          {/* Integration Notes */}
          <Card className="mt-6 p-4">
            <h3 className="font-semibold mb-2">Integration Notes</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                This page demonstrates the ESP32-CAM integration with the AROHAN dashboard. 
                The camera service connects to your ESP32-CAM device and provides live streaming 
                with face detection capabilities.
              </p>
              <p>
                <strong>ESP32-CAM URL:</strong> http://192.168.137.247:81/stream
                (configurable via VITE_ESP32_BASE_URL in .env)
              </p>
              <p>
                <strong>CV Overlay:</strong> Write bounding box data to Firebase path 
                <code className="bg-secondary px-1 rounded">/ronin/rover/cv</code> to see overlays.
              </p>
              <p>
                <strong>Snapshots:</strong> Saved to Firebase Storage at 
                <code className="bg-secondary px-1 rounded">/ronin/snapshots/</code> with metadata 
                in Realtime Database.
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CameraTest;