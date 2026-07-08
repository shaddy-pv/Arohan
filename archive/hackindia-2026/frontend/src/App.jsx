import React, { useState, useEffect } from 'react';
import { ShieldAlert, Activity, Cpu, Wind, Flame, Radio, Navigation, Siren } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock Data
const generateMockData = () => {
  return Array.from({ length: 20 }).map((_, i) => ({
    time: `10:${i < 10 ? '0'+i : i}`,
    gas: Math.floor(Math.random() * 50) + 10,
    temp: Math.floor(Math.random() * 10) + 25,
  }));
};

function App() {
  const [data, setData] = useState(generateMockData());
  const [severity, setSeverity] = useState('SAFE'); // SAFE, WARNING, CRITICAL
  const [roverActive, setRoverActive] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const newArr = [...prev.slice(1)];
        const lastTime = parseInt(prev[prev.length - 1].time.split(':')[1]);
        const nextTime = lastTime === 59 ? '00' : (lastTime + 1).toString().padStart(2, '0');
        
        let newGas = Math.floor(Math.random() * 50) + 10;
        let newTemp = Math.floor(Math.random() * 10) + 25;
        
        // Randomly simulate an event
        if (Math.random() > 0.95) {
          newGas = 350;
          newTemp = 60;
          setSeverity('CRITICAL');
        } else if (severity === 'CRITICAL' && Math.random() > 0.7) {
            setSeverity('SAFE');
        }

        newArr.push({ time: `10:${nextTime}`, gas: newGas, temp: newTemp });
        return newArr;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [severity]);

  return (
    <div className="min-h-screen bg-cyber-dark text-white p-6 font-mono selection:bg-cyber-accent selection:text-black">
      
      {/* Header */}
      <header className="flex justify-between items-center border-b border-cyber-border pb-4 mb-8">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-10 h-10 text-cyber-accent animate-pulse" />
          <h1 className="text-3xl font-bold tracking-widest text-cyber-accent glitch-effect" data-text="AROHHAN">AROHHAN</h1>
        </div>
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm tracking-widest text-gray-400">SYSTEM ONLINE</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">NODE ID</p>
            <p className="font-bold">ESP-A1</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Live Sensors */}
        <div className="flex flex-col gap-6">
          <div className="bg-cyber-panel border border-cyber-border rounded-xl p-5 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
            <h2 className="text-sm text-gray-400 mb-4 tracking-wider flex items-center gap-2"><Activity size={16}/> SENSOR TELEMETRY</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-black/40 p-3 rounded border border-cyber-border/50">
                <div className="flex items-center gap-3"><Flame className="text-orange-500"/> <span>Temp</span></div>
                <span className="text-2xl font-bold">{data[data.length - 1]?.temp}°C</span>
              </div>
              <div className="flex justify-between items-center bg-black/40 p-3 rounded border border-cyber-border/50">
                <div className="flex items-center gap-3"><Wind className="text-cyber-accent"/> <span>MQ-2 Gas</span></div>
                <span className="text-2xl font-bold">{data[data.length - 1]?.gas} ppm</span>
              </div>
              <div className="flex justify-between items-center bg-black/40 p-3 rounded border border-cyber-border/50">
                <div className="flex items-center gap-3"><Cpu className="text-purple-500"/> <span>AI Confidence</span></div>
                <span className="text-2xl font-bold">98.4%</span>
              </div>
            </div>
          </div>

          <div className={`border rounded-xl p-5 transition-all duration-500 ${severity === 'CRITICAL' ? 'bg-cyber-neon/10 border-cyber-neon shadow-[0_0_30px_rgba(255,0,60,0.3)]' : 'bg-cyber-panel border-cyber-border'}`}>
            <h2 className="text-sm text-gray-400 mb-2 tracking-wider flex items-center gap-2"><Siren size={16}/> THREAT LEVEL</h2>
            <div className={`text-4xl font-black tracking-widest mt-4 ${severity === 'CRITICAL' ? 'text-cyber-neon animate-pulse' : 'text-green-400'}`}>
              {severity}
            </div>
            {severity === 'CRITICAL' && (
              <p className="text-xs text-cyber-neon mt-2 uppercase">Immediate Rover Dispatch Recommended</p>
            )}
          </div>
        </div>

        {/* Center Column - Charts */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-cyber-panel border border-cyber-border rounded-xl p-5 h-80 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-accent to-transparent opacity-50"></div>
             <h2 className="text-sm text-gray-400 mb-4 tracking-wider flex items-center gap-2"><Radio size={16}/> MULTI-MODAL FUSION STREAM</h2>
             
             <ResponsiveContainer width="100%" height="85%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" vertical={false} />
                  <XAxis dataKey="time" stroke="#666" tick={{fill: '#666', fontSize: 12}} />
                  <YAxis stroke="#666" tick={{fill: '#666', fontSize: 12}} />
                  <Tooltip contentStyle={{backgroundColor: '#151520', borderColor: '#00f0ff'}} />
                  <Line type="monotone" dataKey="gas" stroke="#00f0ff" strokeWidth={2} dot={false} animationDuration={300} />
                  <Line type="monotone" dataKey="temp" stroke="#ff8a00" strokeWidth={2} dot={false} animationDuration={300} />
                </LineChart>
             </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-6">
             <div className="bg-cyber-panel border border-cyber-border rounded-xl p-5">
                <h2 className="text-sm text-gray-400 mb-4 tracking-wider flex items-center gap-2"><Navigation size={16}/> AUTONOMOUS ROVER</h2>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">STATUS</p>
                    <p className={`font-bold ${roverActive ? 'text-cyber-accent' : 'text-gray-400'}`}>
                      {roverActive ? 'DISPATCHED - SECTOR 4' : 'STANDBY MODE'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setRoverActive(!roverActive)}
                    className={`px-4 py-2 rounded font-bold text-sm transition-all ${roverActive ? 'bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500 hover:text-white' : 'bg-cyber-accent/20 text-cyber-accent border border-cyber-accent hover:bg-cyber-accent hover:text-black'}`}
                  >
                    {roverActive ? 'RECALL' : 'DISPATCH'}
                  </button>
                </div>
             </div>

             <div className="bg-cyber-panel border border-cyber-border rounded-xl p-5 flex flex-col justify-center">
               <button className="w-full py-3 bg-cyber-neon/10 border border-cyber-neon text-cyber-neon hover:bg-cyber-neon hover:text-white transition-all rounded font-bold tracking-widest text-sm flex items-center justify-center gap-2">
                 <Siren size={18} /> INITIATE EMERGENCY LOCKDOWN
               </button>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
