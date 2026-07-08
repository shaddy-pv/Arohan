import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, X, Plus, Circle } from 'lucide-react';
import { ref, set, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface SavedPath {
  id: string;
  label: string;
  lat: number;
  lng: number;
  createdAt: number;
}

interface RoverStatus {
  online: boolean;
  lastHeartbeat: number;
  location?: string;
  battery?: number;
}

export const SavedPaths = () => {
  const [paths, setPaths] = useState<SavedPath[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newPathLabel, setNewPathLabel] = useState('');
  const [roverStatus, setRoverStatus] = useState<RoverStatus | null>(null);
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
  const { toast } = useToast();

  // Load saved paths from localStorage
  useEffect(() => {
    const savedPaths = localStorage.getItem('rover_saved_paths');
    if (savedPaths) {
      try {
        setPaths(JSON.parse(savedPaths));
      } catch (error) {
        console.error('Failed to parse saved paths:', error);
      }
    }
  }, []);

  // Subscribe to rover status from Firebase
  useEffect(() => {
    const statusRef = ref(database, 'ronin/rover/status');
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (typeof data === 'string') {
        setRoverStatus({
          online: true,
          lastHeartbeat: Date.now(),
          location: data,
          battery: 100
        });
      } else if (data) {
        const now = Date.now();
        const lastHeartbeat = data.lastHeartbeat || 0;
        const isOnline = (now - lastHeartbeat) < 30000; // 30 seconds threshold
        
        setRoverStatus({
          online: isOnline,
          lastHeartbeat,
          location: data.location,
          battery: data.battery
        });
      } else {
        setRoverStatus({
          online: false,
          lastHeartbeat: 0
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Save paths to localStorage whenever they change
  const savePaths = (newPaths: SavedPath[]) => {
    localStorage.setItem('rover_saved_paths', JSON.stringify(newPaths));
    setPaths(newPaths);
  };

  // Add current location
  const handleAddCurrentLocation = () => {
    if (!newPathLabel.trim()) {
      toast({
        title: "Label Required",
        description: "Please enter a name for this location",
        variant: "destructive"
      });
      return;
    }

    // In a real implementation, you'd get actual GPS coordinates from the rover
    // For now, we'll use mock coordinates
    const newPath: SavedPath = {
      id: Date.now().toString(),
      label: newPathLabel.trim(),
      lat: 0, // Replace with actual rover GPS lat
      lng: 0, // Replace with actual rover GPS lng
      createdAt: Date.now()
    };

    const updatedPaths = [...paths, newPath];
    savePaths(updatedPaths);
    
    setNewPathLabel('');
    setIsAdding(false);
    
    toast({
      title: "Location Saved",
      description: `"${newPath.label}" has been added to saved paths`
    });
  };

  // Navigate to saved path
  const handleNavigate = async (path: SavedPath) => {
    if (!roverStatus?.online) {
      toast({
        title: "Rover Offline",
        description: "Cannot navigate - rover is not connected",
        variant: "destructive"
      });
      return;
    }

    setIsNavigating(path.id);
    
    try {
      const targetRef = ref(database, 'ronin/rover/target');
      await set(targetRef, {
        lat: path.lat,
        lng: path.lng,
        label: path.label,
        timestamp: Date.now()
      });

      toast({
        title: "Navigation Started",
        description: `Rover is navigating to "${path.label}"`
      });
    } catch (error) {
      toast({
        title: "Navigation Failed",
        description: "Failed to send navigation command to rover",
        variant: "destructive"
      });
    } finally {
      setIsNavigating(null);
    }
  };

  // Delete saved path
  const handleDelete = (pathId: string) => {
    const updatedPaths = paths.filter(p => p.id !== pathId);
    savePaths(updatedPaths);
    
    toast({
      title: "Location Removed",
      description: "Saved path has been deleted"
    });
  };

  return (
    <div className="space-y-4">
      {/* Saved Paths Panel */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            <h2 className="text-lg font-bold">Saved Paths</h2>
          </div>
        </div>

        {/* Add Location Button/Form */}
        {!isAdding ? (
          <Button
            variant="outline"
            className="w-full mb-4"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Current Location
          </Button>
        ) : (
          <div className="mb-4 p-3 bg-secondary rounded-lg">
            <Input
              placeholder="Enter location name..."
              value={newPathLabel}
              onChange={(e) => setNewPathLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCurrentLocation();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewPathLabel('');
                }
              }}
              className="mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddCurrentLocation}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewPathLabel('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Saved Paths List */}
        {paths.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No paths saved yet</p>
            <p className="text-xs mt-1">Add your first location to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paths.map((path) => (
              <div
                key={path.id}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Circle className="w-2 h-2 text-primary flex-shrink-0" />
                  <span className="font-medium truncate">{path.label}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleNavigate(path)}
                    disabled={!roverStatus?.online || isNavigating === path.id}
                    title={!roverStatus?.online ? "Rover is offline" : "Navigate to this location"}
                  >
                    {isNavigating === path.id ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(path.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rover Status Panel */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Rover Status</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Circle
              className={`w-3 h-3 ${
                roverStatus?.online ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
              }`}
            />
            <span className={`font-semibold ${
              roverStatus?.online ? 'text-green-500' : 'text-red-500'
            }`}>
              {roverStatus?.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          {roverStatus?.lastHeartbeat > 0 && (
            <span className="text-xs text-muted-foreground">
              {new Date(roverStatus.lastHeartbeat).toLocaleTimeString()}
            </span>
          )}
        </div>
        {roverStatus?.location && (
          <div className="mt-2 text-xs text-muted-foreground">
            Location: {roverStatus.location}
          </div>
        )}
        {roverStatus?.battery !== undefined && (
          <div className="mt-1 text-xs text-muted-foreground">
            Battery: {roverStatus.battery}%
          </div>
        )}
      </Card>
    </div>
  );
};
