import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { 
  Sprout, Droplet, CheckSquare, ShoppingBag, Users, Gem, Coins, 
  Shovel, ArrowRight, Share2, Heart, Clock, X 
} from 'https://esm.sh/lucide-react@0.294.0?deps=react@18.2.0';

// Firebase Imports (Modular Web SDK)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  getFirestore, collection, doc, setDoc, addDoc, getDoc, 
  onSnapshot, updateDoc, increment, arrayUnion, serverTimestamp, 
  runTransaction, query, orderBy, limit 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- KONFIGURATION ---

// ACHTUNG: Ersetze das hier mit deinen Daten von der Firebase Konsole!
const firebaseConfig = {
  apiKey: "AIzaSyDqEDD2Hds_pX5phI5cZKU3Q-mRtQxTZDg",
  authDomain: "duobloom-a9b7b.firebaseapp.com",
  projectId: "duobloom-a9b7b",
  storageBucket: "duobloom-a9b7b.firebasestorage.app",
  messagingSenderId: "118209789780",
  appId: "1:118209789780:web:ce2563e693a76f09a7d2c1",
  measurementId: "G-Z0W0LK6D88"
};

// App initialisieren
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase Fehler: Hast du die Config eingetragen?", error);
}

// --- SPIEL KONSTANTEN ---

const ITEMS = {
  'seed_carrot': { 
    id: 'seed_carrot', name: 'Karottensamen', type: 'plant', cost: 50, currency: 'coins', 
    icon: '🥕', stages: 3, sellPrice: 5, sellCurrency: 'gems' 
  },
  'seed_flower': { 
    id: 'seed_flower', name: 'Rosenbusch', type: 'plant', cost: 150, currency: 'coins', 
    icon: '🌹', stages: 4, sellPrice: 15, sellCurrency: 'gems' 
  },
  'seed_tree': { 
    id: 'seed_tree', name: 'Apfelbaum', type: 'plant', cost: 500, currency: 'coins', 
    icon: '🌳', stages: 5, sellPrice: 50, sellCurrency: 'gems' 
  },
  'deco_fence': {
    id: 'deco_fence', name: 'Holzzaun', type: 'decor', cost: 200, currency: 'coins', 
    icon: '🪵', stages: 1, sellPrice: 0, sellCurrency: 'none' 
  }
};

const EXPANSION_COST = 50; 
const STARTING_COINS = 100;
const FIRST_TASK_REWARD = 100;

// --- KOMPONENTEN ---

// 1. LOBBY (Startbildschirm)
const Lobby = ({ user, joinRoom, createRoom, loading }) => {
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-green-100 p-4 rounded-full">
            <Sprout size={48} className="text-green-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Unser Garten</h1>
        <p className="text-gray-500 mb-8">Gemeinsam produktiv sein.</p>

        <div className="space-y-4">
          <div className="text-left">
            <label className="text-xs font-bold text-gray-400 uppercase">Neuen Garten anlegen</label>
            <input 
              type="text" 
              placeholder="Name des Gartens" 
              className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <button 
              onClick={() => createRoom(nameInput)}
              disabled={loading || !nameInput.trim()}
              className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Lädt...' : 'Garten erstellen'}
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">ODER</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <div className="text-left">
            <label className="text-xs font-bold text-gray-400 uppercase">Beitreten</label>
            <div className="flex gap-2 mt-1">
              <input 
                type="text" 
                placeholder="Raum-ID eingeben" 
                className="flex-1 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
              />
              <button 
                onClick={() => joinRoom(roomInput)}
                disabled={loading || !roomInput.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. HAUPT APP
const App = () => {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(localStorage.getItem('garden_room_id'));
  const [roomData, setRoomData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('garden'); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auth
  useEffect(() => {
    if(!auth) return;
    const unsubscribe = onAuthStateChanged(auth, setUser);
    signInAnonymously(auth).catch(e => setErrorMsg("Login Fehler: " + e.message));
    return () => unsubscribe();
  }, []);

  // User Data Listener
  useEffect(() => {
    if (!user || !db) return;
    const userRef = doc(db, 'users', user.uid);
    
    // Profil erstellen falls nicht vorhanden
    getDoc(userRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(userRef, { coins: STARTING_COINS, gems: 0, inventory: {} });
      }
    });

    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    return () => unsub();
  }, [user]);

  // Room Data Listener
  useEffect(() => {
    if (!roomId || !db) return;
    const roomRef = doc(db, 'rooms', `room_${roomId}`);
    
    const unsub = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        setRoomData(snap.data());
        localStorage.setItem('garden_room_id', roomId);
      } else {
        setRoomId(null);
        localStorage.removeItem('garden_room_id');
        alert("Raum nicht gefunden!");
      }
    });
    return () => unsub();
  }, [roomId]);

  const handleCreateRoom = async (name) => {
    if (!user) return;
    setLoading(true);
    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomRef = doc(db, 'rooms', `room_${newRoomId}`);
      
      const initialGrid = {};
      for(let i=0; i<16; i++) initialGrid[i] = null;

      await setDoc(roomRef, {
        id: newRoomId,
        name: name,
        owner: user.uid,
        members: [user.uid],
        expansionLevel: 4,
        grid: initialGrid,
        createdAt: serverTimestamp(),
        simulatedDay: 0 
      });
      setRoomId(newRoomId);
    } catch (e) {
      console.error(e);
      alert("Fehler beim Erstellen. Check die Konsole (F12).");
    }
    setLoading(false);
  };

  const handleJoinRoom = async (id) => {
    if (!user) return;
    setLoading(true);
    const cleanId = id.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', `room_${cleanId}`);
    const snap = await getDoc(roomRef);
    
    if (snap.exists()) {
      await updateDoc(roomRef, { members: arrayUnion(user.uid) });
      setRoomId(cleanId);
    } else {
      alert("Raum existiert nicht!");
    }
    setLoading(false);
  };

  if (firebaseConfig.apiKey === "DEIN_API_KEY") {
      return <div className="p-10 text-center text-red-600 font-bold">FEHLER: Du musst die 'game.jsx' Datei öffnen und deine Firebase Config eintragen!</div>
  }

  if (!user) return <div className="h-screen flex items-center justify-center text-green-600 animate-pulse">{errorMsg || 'Lade Garten...'}</div>;

  if (!roomId) {
    return <Lobby user={user} joinRoom={handleJoinRoom} createRoom={handleCreateRoom} loading={loading} />;
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-50 flex flex-col relative shadow-2xl overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex justify-between items-center shadow-sm z-10">
        <div>
          <h2 className="font-bold text-gray-800">{roomData?.name || 'Garten'}</h2>
          <div className="flex gap-3 text-xs font-medium mt-1">
            <span className="flex items-center text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
              <Coins size={12} className="mr-1" /> {userData?.coins || 0}
            </span>
            <span className="flex items-center text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              <Gem size={12} className="mr-1" /> {userData?.gems || 0}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => { navigator.clipboard.writeText(roomId); alert("ID kopiert: " + roomId); }} className="p-2 bg-gray-100 rounded-full text-gray-600">
            <Share2 size={18} />
          </button>
           <button onClick={() => { setRoomId(null); localStorage.removeItem('garden_room_id'); }} className="p-2 bg-gray-100 rounded-full text-red-400">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'garden' && <GardenView room={roomData} user={user} userData={userData} />}
        {activeTab === 'tasks' && <TasksView roomId={roomId} user={user} />}
        {activeTab === 'shop' && <ShopView user={user} userData={userData} />}
      </div>

      {/* Navigation */}
      <div className="bg-white border-t border-gray-200 p-2 pb-6 flex justify-around items-center z-20">
        <NavButton icon={Sprout} label="Garten" active={activeTab === 'garden'} onClick={() => setActiveTab('garden')} />
        <NavButton icon={CheckSquare} label="Aufgaben" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
        <NavButton icon={ShoppingBag} label="Shop" active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} />
      </div>
    </div>
  );
};

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 transition-colors ${active ? 'text-green-600' : 'text-gray-400'}`}>
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[10px] mt-1 font-medium">{label}</span>
  </button>
);

// --- VIEWS ---

const GardenView = ({ room, user, userData }) => {
  const [selectedCell, setSelectedCell] = useState(null);
  
  const simulateDay = async () => {
    const roomRef = doc(db, 'rooms', `room_${room.id}`);
    await updateDoc(roomRef, { simulatedDay: increment(1) });
  };

  const handlePlant = async (itemId) => {
    if (selectedCell === null) return;
    if ((userData.inventory?.[itemId] || 0) <= 0) { alert("Keine Samen mehr!"); return; }

    const roomRef = doc(db, 'rooms', `room_${room.id}`);
    const userRef = doc(db, 'users', user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        transaction.update(userRef, { [`inventory.${itemId}`]: increment(-1) });
        transaction.update(roomRef, {
          [`grid.${selectedCell}`]: {
            type: itemId, plantedAtDay: room.simulatedDay || 0,
            waterLevel: 0, lastWateredDay: -1, stage: 0, plantedBy: user.uid
          }
        });
      });
      setSelectedCell(null);
    } catch (e) { console.error(e); }
  };

  const handleWater = async (cellIndex, cellData) => {
    if(cellData.lastWateredDay === room.simulatedDay) { alert("Heute schon gegossen!"); return; }
    const roomRef = doc(db, 'rooms', `room_${room.id}`);
    const itemConfig = ITEMS[cellData.type];
    let newStage = Math.min(cellData.stage + 1, itemConfig.stages);

    await updateDoc(roomRef, {
      [`grid.${cellIndex}.lastWateredDay`]: room.simulatedDay,
      [`grid.${cellIndex}.waterLevel`]: cellData.waterLevel + 1,
      [`grid.${cellIndex}.stage`]: newStage
    });
  };

  const handleHarvest = async (cellIndex, cellData) => {
    const itemConfig = ITEMS[cellData.type];
    if (cellData.stage < itemConfig.stages) return;
    const roomRef = doc(db, 'rooms', `room_${room.id}`);
    const userRef = doc(db, 'users', user.uid);

    await runTransaction(db, async (transaction) => {
        transaction.update(roomRef, { [`grid.${cellIndex}`]: null });
        if (itemConfig.sellPrice > 0) {
            transaction.update(userRef, { [itemConfig.sellCurrency]: increment(itemConfig.sellPrice) });
        }
    });
  };

  const handleExpand = async () => {
      if(userData.gems < EXPANSION_COST) { alert("Nicht genug Edelsteine!"); return; }
      const roomRef = doc(db, 'rooms', `room_${room.id}`);
      const userRef = doc(db, 'users', user.uid);
      
      await runTransaction(db, async (t) => {
            t.update(userRef, { gems: increment(-EXPANSION_COST) });
            const currentSize = room.expansionLevel * room.expansionLevel;
            const newLevel = room.expansionLevel + 1;
            const updates = { expansionLevel: newLevel };
            for(let i = currentSize; i < newLevel * newLevel; i++) updates[`grid.${i}`] = null;
            t.update(roomRef, updates);
      });
  };

  const size = room?.expansionLevel || 4;
  
  return (
    <div className="h-full flex flex-col bg-green-50 overflow-y-auto pb-20">
      <div className="bg-yellow-50 p-2 flex justify-between items-center border-b border-yellow-100 sticky top-0 z-10">
        <span className="text-xs text-yellow-800 font-mono">Tag: {room.simulatedDay || 0}</span>
        <button onClick={simulateDay} className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded flex items-center">
          <Clock size={12} className="mr-1" /> Neuer Tag (Test)
        </button>
      </div>

      <div className="flex-1 p-4 flex items-center justify-center min-h-[400px]">
        <div className="w-full max-w-[350px] aspect-square bg-stone-200 p-2 rounded-xl shadow-inner border-4 border-stone-300 grid gap-1" 
             style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
          {Array.from({ length: size * size }).map((_, i) => {
            const cell = room.grid?.[i];
            return (
              <div key={i} onClick={() => !cell && setSelectedCell(i)}
                className={`relative bg-[#8B5E3C] rounded-md shadow-sm flex items-center justify-center cursor-pointer overflow-hidden ${selectedCell === i ? 'ring-4 ring-green-400 z-10' : ''}`}>
                 {!cell && <div className="opacity-10 text-black text-[8px]">{i}</div>}
                 {cell && (
                   <div className="flex flex-col items-center animate-bounce-short">
                      <span className="text-2xl drop-shadow-md">{cell.stage === 0 ? '🌱' : ITEMS[cell.type].icon}</span>
                      {ITEMS[cell.type].stages > 1 && (
                         <div className="w-8 h-1 bg-gray-700 mt-1 rounded-full"><div className="h-full bg-green-500" style={{ width: `${(cell.stage / ITEMS[cell.type].stages) * 100}%` }} /></div>
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center gap-1 transition-opacity backdrop-blur-[1px]">
                         {cell.stage < ITEMS[cell.type].stages && (
                            <button onClick={(e) => { e.stopPropagation(); handleWater(i, cell); }} className="p-1 bg-blue-500 text-white rounded-full"><Droplet size={14} /></button>
                         )}
                         {cell.stage >= ITEMS[cell.type].stages && (
                            <button onClick={(e) => { e.stopPropagation(); handleHarvest(i, cell); }} className="p-1 bg-yellow-500 text-white rounded-full animate-pulse"><Shovel size={14} /></button>
                         )}
                      </div>
                   </div>
                 )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="p-4 flex justify-center">
          <button onClick={handleExpand} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold">
              <Gem size={16} /> Land Erweitern ({EXPANSION_COST})
          </button>
      </div>

      {selectedCell !== null && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 pb-24 z-20 animate-slide-up">
           <div className="flex justify-between items-center mb-3">
             <h3 className="font-bold text-gray-700">Samen wählen</h3>
             <button onClick={() => setSelectedCell(null)} className="text-gray-400"><X size={20}/></button>
           </div>
           <div className="grid grid-cols-4 gap-2">
             {Object.keys(userData?.inventory || {}).map(itemId => (
                (userData.inventory[itemId] > 0) && (
                  <button key={itemId} onClick={() => handlePlant(itemId)} className="flex flex-col items-center p-2 bg-green-50 rounded-lg">
                    <span className="text-2xl mb-1">{ITEMS[itemId].icon}</span>
                    <span className="text-[10px] bg-green-200 text-green-800 px-1.5 rounded-full">x{userData.inventory[itemId]}</span>
                  </button>
                )
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

  useEffect(() => {
    const tasksRef = collection(db, 'rooms', `room_${roomId}`, 'tasks');
    const q = query(tasksRef, orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [roomId]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    const tasksRef = collection(db, 'rooms', `room_${roomId}`, 'tasks');
    await addDoc(tasksRef, {
      title: newTask, completed: false, createdBy: user.uid,
      reward: 10, createdAt: serverTimestamp()
    });
    setNewTask('');
  };

  const completeTask = async (task) => {
    if (task.completed) return;
    const taskRef = doc(db, 'rooms', `room_${roomId}`, 'tasks', task.id);
    const userRef = doc(db, 'users', user.uid);
    await runTransaction(db, async (t) => {
        t.update(taskRef, { completed: true, completedBy: user.uid });
        t.update(userRef, { coins: increment(task.reward) });
    });
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col p-4 pb-24 overflow-y-auto">
      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Neue Aufgabe</h3>
        <div className="flex gap-2">
          <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="z.B. 10 Min lesen" className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm" />
          <button onClick={addTask} className="bg-green-600 text-white p-2 rounded-lg"><ArrowRight size={20} /></button>
        </div>
      </div>
      <div className="space-y-2">
        {tasks.map(task => (
          <div key={task.id} className={`p-4 rounded-xl border flex justify-between ${task.completed ? 'bg-gray-100 opacity-60' : 'bg-white'}`}>
            <div><p className="font-medium">{task.title}</p><span className="text-xs text-yellow-600">+{task.reward} Coins</span></div>
            <button onClick={() => completeTask(task)} disabled={task.completed}><CheckSquare size={24} className={task.completed ? 'text-green-600' : 'text-gray-300'} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ShopView = ({ user, userData }) => {
  const buyItem = async (itemId) => {
    const item = ITEMS[itemId];
    if (userData.coins < item.cost) { alert("Nicht genug Münzen!"); return; }
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { coins: increment(-item.cost), [`inventory.${itemId}`]: increment(1) });
  };

  return (
    <div className="h-full bg-gray-50 p-4 pb-24 overflow-y-auto">
      <div className="bg-orange-50 p-4 rounded-xl mb-6 shadow-sm border border-orange-200">
        <h2 className="font-bold text-orange-800 flex items-center"><ShoppingBag className="mr-2" size={20}/> Laden</h2>
      </div>
      <div className="grid gap-3">
        {Object.values(ITEMS).map(item => (
          <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center"><div className="text-3xl mr-4">{item.icon}</div><div><h3 className="font-bold">{item.name}</h3><p className="text-xs text-gray-500">{item.cost} Münzen</p></div></div>
            <button onClick={() => buyItem(item.id)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Kaufen</button>
          </div>
        ))}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);

