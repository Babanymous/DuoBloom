import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { 
  Sprout, Droplet, CheckSquare, ShoppingBag, Users, Gem, Coins, 
  Shovel, ArrowRight, Share2, Heart, Clock, X, AlertTriangle, Loader2 
} from 'https://esm.sh/lucide-react@0.294.0?deps=react@18.2.0';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  getFirestore, collection, doc, setDoc, addDoc, getDoc, 
  onSnapshot, updateDoc, increment, arrayUnion, serverTimestamp, 
  runTransaction, query, orderBy, limit 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- FEHLER-ABFANG-KOMPONENTE (Wichtig für Tablets) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, info) { this.setState({ error, info }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 text-red-900 min-h-screen font-sans">
          <h1 className="text-xl font-bold flex items-center mb-4"><AlertTriangle className="mr-2"/> Upps, ein Fehler!</h1>
          <p className="mb-2">Bitte mach einen Screenshot davon:</p>
          <pre className="bg-white p-4 rounded border border-red-200 overflow-auto text-xs">
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-4 bg-red-600 text-white px-4 py-2 rounded">
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// --- KONFIGURATION ---

// FÜGE HIER WIEDER DEINE DATEN EIN
const firebaseConfig = {
  apiKey: "AIzaSyDqEDD2Hds_pX5phI5cZKU3Q-mRtQxTZDg",
  authDomain: "duobloom-a9b7b.firebaseapp.com",
  projectId: "duobloom-a9b7b",
  storageBucket: "duobloom-a9b7b.firebasestorage.app",
  messagingSenderId: "118209789780",
  appId: "1:118209789780:web:ce2563e693a76f09a7d2c1",
  measurementId: "G-Z0W0LK6D88"
};

// Init Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase Config Error", error);
}

// --- SPIEL KONSTANTEN ---
const ITEMS = {
  'seed_carrot': { id: 'seed_carrot', name: 'Karottensamen', type: 'plant', cost: 50, currency: 'coins', icon: '🥕', stages: 3, sellPrice: 5, sellCurrency: 'gems' },
  'seed_flower': { id: 'seed_flower', name: 'Rosenbusch', type: 'plant', cost: 150, currency: 'coins', icon: '🌹', stages: 4, sellPrice: 15, sellCurrency: 'gems' },
  'seed_tree': { id: 'seed_tree', name: 'Apfelbaum', type: 'plant', cost: 500, currency: 'coins', icon: '🌳', stages: 5, sellPrice: 50, sellCurrency: 'gems' },
  'deco_fence': { id: 'deco_fence', name: 'Holzzaun', type: 'decor', cost: 200, currency: 'coins', icon: '🪵', stages: 1, sellPrice: 0, sellCurrency: 'none' }
};
const EXPANSION_COST = 50; 
const STARTING_COINS = 100;

// --- HAUPT APP ---
const App = () => {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(localStorage.getItem('garden_room_id'));
  const [roomData, setRoomData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('garden'); 
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState('');

  // 1. Auth Init
  useEffect(() => {
    if(!auth) { setInitError("Firebase Config fehlt!"); return; }
    const unsubscribe = onAuthStateChanged(auth, setUser);
    signInAnonymously(auth).catch(e => setInitError(e.message));
    return () => unsubscribe();
  }, []);

  // 2. User Data Listener
  useEffect(() => {
    if (!user || !db) return;
    const userRef = doc(db, 'users', user.uid);
    getDoc(userRef).then((snap) => {
      if (!snap.exists()) setDoc(userRef, { coins: STARTING_COINS, gems: 0, inventory: {} });
    });
    const unsub = onSnapshot(userRef, (snap) => { if (snap.exists()) setUserData(snap.data()); });
    return () => unsub();
  }, [user]);

  // 3. Room Data Listener
  useEffect(() => {
    if (!roomId || !db) return;
    const roomRef = doc(db, 'rooms', `room_${roomId}`);
    
    const unsub = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        setRoomData(snap.data());
        localStorage.setItem('garden_room_id', roomId);
      } else {
        // Wenn Raum gelöscht wurde oder ungültig ist
        if(!loading) { // Nur resetten wenn wir nicht gerade erstellen
            // setRoomId(null);
        }
      }
    }, (err) => {
        console.error("Room Error", err);
        // Permission Error abfangen
        if(err.code === 'permission-denied') alert("Fehler: Datenbank-Regeln verbieten Zugriff. Hast du 'Test Mode' an?");
    });
    return () => unsub();
  }, [roomId]);

  const handleCreateRoom = async (name) => {
    if (!user) return;
    setLoading(true);
    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const initialGrid = {};
      for(let i=0; i<16; i++) initialGrid[i] = null;

      await setDoc(doc(db, 'rooms', `room_${newRoomId}`), {
        id: newRoomId, name: name, owner: user.uid, members: [user.uid],
        expansionLevel: 4, grid: initialGrid, createdAt: serverTimestamp(), simulatedDay: 0 
      });
      // WICHTIG: Erst ID setzen, wenn Write fertig ist
      setRoomId(newRoomId);
    } catch (e) {
      alert("Fehler beim Erstellen: " + e.message);
    }
    setLoading(false);
  };

  const handleJoinRoom = async (id) => {
    if (!user) return;
    setLoading(true);
    const cleanId = id.trim().toUpperCase();
    const snap = await getDoc(doc(db, 'rooms', `room_${cleanId}`));
    if (snap.exists()) {
      await updateDoc(doc(db, 'rooms', `room_${cleanId}`), { members: arrayUnion(user.uid) });
      setRoomId(cleanId);
    } else {
      alert("Raum nicht gefunden!");
    }
    setLoading(false);
  };

  // RENDER LOGIK

  // Config fehlt?
  if (firebaseConfig.apiKey === "DEIN_API_KEY") {
      return <div className="p-10 text-center text-red-600 font-bold font-sans">FEHLER: Bitte trage deine Firebase Config in game.jsx ein!</div>
  }

  // Auth läuft noch?
  if (!user) return <div className="h-screen flex flex-col items-center justify-center text-green-600 animate-pulse font-sans"><Sprout size={40} className="mb-4"/>{initError || 'Verbinde mit Server...'}</div>;

  // Noch in Lobby?
  if (!roomId) {
    return <Lobby user={user} joinRoom={handleJoinRoom} createRoom={handleCreateRoom} loading={loading} />;
  }

  // WICHTIGE ÄNDERUNG: Wenn RoomID da ist, aber Daten noch laden -> Loading Screen
  // Das verhindert den Whitescreen Crash!
  if (roomId && !roomData) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-green-50 text-green-800 font-sans">
            <Loader2 size={40} className="animate-spin mb-4"/>
            <p>Lade Garten...</p>
            <button onClick={()=>{setRoomId(null); localStorage.removeItem('garden_room_id')}} className="mt-8 text-xs text-gray-400 underline">Zurück zur Lobby</button>
        </div>
      );
  }

  // App ist bereit
  return (
    <div className="max-w-md mx-auto h-screen bg-gray-50 flex flex-col relative shadow-2xl overflow-hidden font-sans">
      <div className="bg-white px-4 py-3 flex justify-between items-center shadow-sm z-10">
        <div>
          <h2 className="font-bold text-gray-800 truncate max-w-[150px]">{roomData.name}</h2>
          <div className="flex gap-3 text-xs font-medium mt-1">
            <span className="flex items-center text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full"><Coins size={12} className="mr-1" /> {userData?.coins || 0}</span>
            <span className="flex items-center text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full"><Gem size={12} className="mr-1" /> {userData?.gems || 0}</span>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => { navigator.clipboard.writeText(roomId); alert("ID: " + roomId); }} className="p-2 bg-gray-100 rounded-full text-gray-600"><Share2 size={18} /></button>
           <button onClick={() => { setRoomId(null); localStorage.removeItem('garden_room_id'); }} className="p-2 bg-gray-100 rounded-full text-red-400"><X size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'garden' && <GardenView room={roomData} user={user} userData={userData} />}
        {activeTab === 'tasks' && <TasksView roomId={roomId} user={user} />}
        {activeTab === 'shop' && <ShopView user={user} userData={userData} />}
      </div>

      <div className="bg-white border-t border-gray-200 p-2 pb-6 flex justify-around items-center z-20">
        <NavButton icon={Sprout} label="Garten" active={activeTab === 'garden'} onClick={() => setActiveTab('garden')} />
        <NavButton icon={CheckSquare} label="Aufgaben" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
        <NavButton icon={ShoppingBag} label="Shop" active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} />
      </div>
    </div>
  );
};

// --- SUB KOMPONENTEN ---

const Lobby = ({ createRoom, joinRoom, loading }) => (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md text-center">
        <Sprout size={48} className="text-green-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Unser Garten</h1>
        <div className="space-y-4">
            <input id="gardenName" type="text" placeholder="Garten Name" className="w-full p-3 border rounded-lg" />
            <button onClick={() => createRoom(document.getElementById('gardenName').value)} disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">
                {loading ? '...' : 'Garten Erstellen'}
            </button>
            <div className="border-t pt-4 mt-4">
                <input id="roomCode" type="text" placeholder="Raum Code" className="w-full p-3 border rounded-lg mb-2" />
                <button onClick={() => joinRoom(document.getElementById('roomCode').value)} disabled={loading} className="w-full bg-blue-500 text-white py-3 rounded-lg font-bold">Beitreten</button>
            </div>
        </div>
      </div>
    </div>
);

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center w-16 ${active ? 'text-green-600' : 'text-gray-400'}`}>
    <Icon size={24} strokeWidth={active ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">{label}</span>
  </button>
);

const GardenView = ({ room, user, userData }) => {
  const [selectedCell, setSelectedCell] = useState(null);
  
  const handlePlant = async (itemId) => {
    if (selectedCell === null || (userData.inventory?.[itemId] || 0) <= 0) return;
    try {
      await runTransaction(db, async (t) => {
        t.update(doc(db, 'users', user.uid), { [`inventory.${itemId}`]: increment(-1) });
        t.update(doc(db, 'rooms', `room_${room.id}`), { [`grid.${selectedCell}`]: { type: itemId, plantedAtDay: room.simulatedDay || 0, waterLevel: 0, lastWateredDay: -1, stage: 0, plantedBy: user.uid } });
      });
      setSelectedCell(null);
    } catch (e) { alert(e.message); }
  };

  const handleWater = async (idx, cell) => {
    if(cell.lastWateredDay === room.simulatedDay) { alert("Schon gegossen!"); return; }
    const item = ITEMS[cell.type];
    await updateDoc(doc(db, 'rooms', `room_${room.id}`), { [`grid.${idx}.lastWateredDay`]: room.simulatedDay, [`grid.${idx}.waterLevel`]: cell.waterLevel + 1, [`grid.${idx}.stage`]: Math.min(cell.stage + 1, item.stages) });
  };

  const handleHarvest = async (idx, cell) => {
    const item = ITEMS[cell.type];
    if (cell.stage < item.stages) return;
    await runTransaction(db, async (t) => {
        t.update(doc(db, 'rooms', `room_${room.id}`), { [`grid.${idx}`]: null });
        if (item.sellPrice > 0) t.update(doc(db, 'users', user.uid), { [item.sellCurrency]: increment(item.sellPrice) });
    });
  };

  const handleExpand = async () => {
      if(userData.gems < EXPANSION_COST) { alert("Nicht genug Gems!"); return; }
      await runTransaction(db, async (t) => {
            t.update(doc(db, 'users', user.uid), { gems: increment(-EXPANSION_COST) });
            const newLevel = room.expansionLevel + 1;
            const updates = { expansionLevel: newLevel };
            for(let i = room.expansionLevel**2; i < newLevel**2; i++) updates[`grid.${i}`] = null;
            t.update(doc(db, 'rooms', `room_${room.id}`), updates);
      });
  };

  const size = room?.expansionLevel || 4;
  return (
    <div className="h-full flex flex-col bg-green-50 overflow-y-auto pb-20">
      <div className="bg-yellow-50 p-2 flex justify-between items-center border-b sticky top-0 z-10">
        <span className="text-xs text-yellow-800 font-mono">Tag: {room.simulatedDay || 0}</span>
        <button onClick={() => updateDoc(doc(db, 'rooms', `room_${room.id}`), { simulatedDay: increment(1) })} className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded flex items-center"><Clock size={12} className="mr-1" /> Skip</button>
      </div>
      <div className="flex-1 p-4 flex items-center justify-center min-h-[400px]">
        <div className="w-full max-w-[350px] aspect-square bg-stone-200 p-2 rounded-xl border-4 border-stone-300 grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
          {Array.from({ length: size * size }).map((_, i) => {
            const cell = room.grid?.[i];
            return (
              <div key={i} onClick={() => !cell && setSelectedCell(i)} className={`relative bg-[#8B5E3C] rounded-md flex items-center justify-center cursor-pointer overflow-hidden ${selectedCell === i ? 'ring-4 ring-green-400 z-10' : ''}`}>
                 {cell ? (
                   <div className="flex flex-col items-center animate-bounce-short">
                      <span className="text-2xl drop-shadow-md">{cell.stage === 0 ? '🌱' : ITEMS[cell.type].icon}</span>
                      {ITEMS[cell.type].stages > 1 && (<div className="w-6 h-1 bg-gray-700 mt-1 rounded-full"><div className="h-full bg-green-500" style={{ width: `${(cell.stage / ITEMS[cell.type].stages) * 100}%` }} /></div>)}
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center gap-1 backdrop-blur-[1px]">
                         {cell.stage < ITEMS[cell.type].stages ? <button onClick={(e) => { e.stopPropagation(); handleWater(i, cell); }} className="p-1 bg-blue-500 text-white rounded-full"><Droplet size={14} /></button>
                         : <button onClick={(e) => { e.stopPropagation(); handleHarvest(i, cell); }} className="p-1 bg-yellow-500 text-white rounded-full animate-pulse"><Shovel size={14} /></button>}
                      </div>
                   </div>
                 ) : <div className="opacity-10 text-black text-[8px]">{i}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="p-4 flex justify-center"><button onClick={handleExpand} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold"><Gem size={16} /> Erweitern ({EXPANSION_COST})</button></div>
      {selectedCell !== null && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 pb-24 z-20 animate-slide-up">
           <div className="flex justify-between items-center mb-3"><h3 className="font-bold">Samen wählen</h3><button onClick={() => setSelectedCell(null)}><X/></button></div>
           <div className="grid grid-cols-4 gap-2">
             {Object.keys(userData?.inventory || {}).map(id => (userData.inventory[id] > 0) && (
               <button key={id} onClick={() => handlePlant(id)} className="flex flex-col items-center p-2 bg-green-50 rounded-lg"><span className="text-2xl">{ITEMS[id].icon}</span><span className="text-xs">x{userData.inventory[id]}</span></button>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

const TasksView = ({ roomId, user }) => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'rooms', `room_${roomId}`, 'tasks'), orderBy('createdAt', 'desc'), limit(50)), (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() })))), [roomId]);
  const addTask = async () => { if (!newTask.trim()) return; await addDoc(collection(db, 'rooms', `room_${roomId}`, 'tasks'), { title: newTask, completed: false, createdBy: user.uid, reward: 10, createdAt: serverTimestamp() }); setNewTask(''); };
  return (
    <div className="h-full bg-gray-50 flex flex-col p-4 pb-24 overflow-y-auto">
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4 flex gap-2"><input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Aufgabe..." className="flex-1 border rounded px-3 py-2" /><button onClick={addTask} className="bg-green-600 text-white p-2 rounded"><ArrowRight size={20} /></button></div>
      <div className="space-y-2">{tasks.map(t => (<div key={t.id} className={`p-4 rounded border flex justify-between ${t.completed ? 'bg-gray-100 opacity-60' : 'bg-white'}`}><div>{t.title} <span className="text-xs text-yellow-600">+{t.reward}</span></div><button onClick={() => !t.completed && runTransaction(db, async (tr) => { tr.update(doc(db, 'rooms', `room_${roomId}`, 'tasks', t.id), { completed: true }); tr.update(doc(db, 'users', user.uid), { coins: increment(t.reward) }); })}><CheckSquare size={24} className={t.completed ? 'text-green-600' : 'text-gray-300'} /></button></div>))}</div>
    </div>
  );
};

const ShopView = ({ user, userData }) => (
    <div className="h-full bg-gray-50 p-4 pb-24 overflow-y-auto grid gap-3">
        {Object.values(ITEMS).map(i => (
          <div key={i.id} className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center text-3xl mr-4">{i.icon} <div><h3 className="text-sm font-bold text-black">{i.name}</h3><p className="text-xs text-gray-500">{i.cost} $</p></div></div>
            <button onClick={() => userData.coins >= i.cost && updateDoc(doc(db, 'users', user.uid), { coins: increment(-i.cost), [`inventory.${i.id}`]: increment(1) })} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Kaufen</button>
          </div>
        ))}
    </div>
);

// --- START ---
const root = createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><App /></ErrorBoundary>);


