import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, getDoc, getDocs, addDoc, arrayUnion, increment, deleteField, query, limit, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { GoogleGenAI } from "@google/genai";

// CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDqEDD2Hds_pX5phI5cZKU3Q-mRtQxTZDg",
    authDomain: "duobloom-a9b7b.firebaseapp.com",
    projectId: "duobloom-a9b7b",
    storageBucket: "duobloom-a9b7b.firebasestorage.app",
    messagingSenderId: "118209789780",
    appId: "1:118209789780:web:ce2563e693a76f09a7d2c1",
    measurementId: "G-Z0W0LK6D88"
};

let firebaseApp, auth, db;
try {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
} catch (e) { console.error("Init Error", e); }

const WATER_COOLDOWN = 6 * 60 * 60 * 1000; 
const GARDEN_BG = "assets/gbg.png"; 
const OCTO_IMG = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Octopus.png";

const BASE_ITEMS = {
    carrot_seed: { id: 'carrot_seed', name: 'Karotte', type: 'seed', price: 20, img: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Food/Carrot.png', icon: '🥕', growsInto: 'carrot', stages: 3, reward: 10 },
    sunflower_seed: { id: 'sunflower_seed', name: 'Sonnenblume', type: 'seed', price: 60, img: 'assets/sunflower.png', icon: '🌻', growsInto: 'sunflower', stages: 4, reward: 20 },
    forgetmenot_seed: { id: 'forgetmenot_seed', name: 'Vergissmeinnicht', type: 'seed', price: 100, img: 'assets/forgetmenot.png', icon: '🪻', growsInto: 'forgetmenot', stages: 6, reward: 50 },
    stone_floor: { id: 'stone_floor', name: 'Steinweg', type: 'floor', price: 10, css: 'texture-stone', icon: '🪨' },
    wood_floor: { id: 'wood_floor', name: 'Holzboden', type: 'floor', price: 25, css: 'texture-wood', icon: '🪵' },
    fence: { id: 'fence', name: 'Zaun', type: 'deco', price: 15, img: 'assets/fence.png', icon: '🚧' },
    bench: { id: 'bench', name: 'Bank', type: 'deco', price: 150, img: 'assets/bench.png', icon: '🪑' },
    gnome: { id: 'gnome', name: 'Zwerg', type: 'deco', price: 250, img: 'assets/gnome.png', icon: '🎅' },
};

const GARDEN_UPGRADES = [
    { id: 0, name: "Start-Garten", price: 0 },
    { id: 1, name: "Hinterhof", price: 200 },
    { id: 2, name: "Waldlichtung", price: 650 },
];

// --- COMPONENTS ---

const Icon = ({ name, size = 24, className = "" }) => {
    const ref = React.useRef(null);
    React.useEffect(() => {
        if ((window as any).lucide && ref.current) {
            const i = document.createElement('i');
            i.setAttribute('data-lucide', name);
            i.setAttribute('width', String(size));
            i.setAttribute('height', String(size));
            if(className) i.setAttribute('class', className);
            ref.current.innerHTML = '';
            ref.current.appendChild(i);
            try { (window as any).lucide.createIcons({ root: ref.current, nameAttr: 'data-lucide', attrs: { width: size, height: size, class: className } }); } catch(e){}
        }
    }, [name, size, className]);
    return <span ref={ref} style={{ display: 'inline-flex', verticalAlign: 'middle' }} />;
};

const ItemDisplay = ({ item, className = "" }) => {
    const [hasError, setHasError] = React.useState(false);
    if (!item) return null;
    if (item.img && !hasError) {
        return <img src={item.img} alt={item.name} className={`${className} object-contain drop-shadow-md`} onError={() => setHasError(true)} />;
    }
    return <span className={`flex items-center justify-center ${className} text-2xl`}>{String(item.icon || "•")}</span>;
};

const getStreakStyle = (streak) => {
    if (streak === 0) return "from-slate-400 to-slate-500"; 
    if (streak < 3) return "from-blue-400 to-indigo-500"; 
    if (streak < 7) return "from-orange-500 to-red-500"; 
    if (streak < 14) return "from-purple-500 to-pink-500"; 
    if (streak < 30) return "from-cyan-400 to-blue-600"; 
    return "from-yellow-400 to-yellow-600 border-2 border-yellow-200"; 
};

// --- GRID CELL ---

const GridCell = ({ x, y, cell, handleGridClick, now, items }: { x: number, y: number, cell: any, handleGridClick: any, now: number, items: any }) => {
    const floorItem = cell.floor ? items[cell.floor] : null;
    const objectItem = cell.item ? items[cell.item] : null;
    let showTimer = false, timeLeftStr = "";

    if (objectItem && objectItem.type === 'seed' && !cell.grown) {
        const lastWatered = cell.lastWatered ? new Date(cell.lastWatered).getTime() : 0;
        const diff = now - lastWatered;
        if (diff < WATER_COOLDOWN) {
            showTimer = true;
            const ms = WATER_COOLDOWN - diff;
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            timeLeftStr = h + "h " + m + "m";
        }
    }

    return (
        <div onClick={() => handleGridClick(x, y)} className={`w-14 h-14 md:w-20 md:h-20 relative cursor-pointer ${floorItem ? floorItem.css : 'bg-white/10 border border-white/20'}`}>
            {objectItem && (
                <div className="absolute inset-0 flex items-center justify-center z-10 hover:scale-110 transition-transform">
                    {cell.grown || objectItem.type === 'deco' ? (
                        <ItemDisplay item={objectItem} className="w-10 h-10 md:w-16 md:h-16" />
                    ) : (
                        <div className="flex flex-col items-center relative">
                            <ItemDisplay item={objectItem} className="w-8 h-8 md:w-12 md:h-12" />
                            {showTimer ? (
                                <div className="absolute -top-4 bg-black/70 text-white text-[8px] md:text-[10px] px-1.5 rounded-full backdrop-blur-sm pointer-events-none whitespace-nowrap">{timeLeftStr}</div>
                            ) : (
                                <div className="absolute -top-4 bg-blue-500 text-white text-[8px] px-1 rounded-full animate-bounce">Gießen!</div>
                            )}
                            <div className="w-8 h-1 bg-black/20 rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all" style={{width: `${(cell.stage/objectItem.stages)*100}%`}} />
                            </div>
                        </div>
                    )}
                </div>
            )}
            {!objectItem && floorItem && <div className="absolute inset-0 hover:bg-white/20"></div>}
        </div>
    );
};

// --- ERROR & MODALS ---

class ErrorBoundary extends React.Component<any, any> {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) { return <div className="p-4 text-red-500">Kritischer Fehler. <button onClick={()=>window.location.reload()} className="underline">Neustart</button></div>; }
        return this.props.children; 
    }
}

const Modal = ({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-pop">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                <button onClick={onClose}><Icon name="x" className="text-gray-500 hover:text-red-500" /></button>
            </div>
            <div className="p-4 overflow-y-auto">{children}</div>
        </div>
    </div>
);

// --- OCTO CHAT ---

const OctoChat = ({ user, roomData }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [messages, setMessages] = React.useState([
        { role: 'model', text: `Blub Blub! 🐙 Hallo ${user.displayName?.split(' ')[0] || 'Freund'}! Ich bin Octo, dein Garten-Assistent.` }
    ]);
    const [input, setInput] = React.useState("");
    const [isTyping, setIsTyping] = React.useState(false);
    const messagesEndRef = React.useRef(null);
    
    // Fallback Wissen für den Fall, dass keine API verfügbar ist
    const OCTO_KNOWLEDGE = [
        { keys: ["schwarzmarkt", "black market", "illegal"], answer: "Psst! 🤫 Auf dem Schwarzmarkt kannst du eigene Pflanzen verkaufen. Aber Vorsicht: Die Teilnahme kostet Gems!" },
        { keys: ["hallo", "hi ", "hey", "moin"], answer: "Blub Blub! 👋 Schön dich zu sehen! Wie laufen die Geschäfte im Garten? 🐙" },
        { keys: ["karotte", "möhre"], answer: "Karotten 🥕 sind der perfekte Einstieg! Sie sind billig, wachsen schnell und schmecken knackig." },
        { keys: ["gießen", "wasser"], answer: "Wasser marsch! 💧 Pflanzen brauchen alle 6 Stunden Wasser. Achte auf das blaue Schild." },
        { keys: ["gems", "edelsteine"], answer: "Gems sind super selten! 💎 Du bekommst sie durch Ernten. Auf dem Schwarzmarkt brauchst du sie, um eigene Pflanzen anzubieten." },
        { keys: ["coins", "münzen"], answer: "Münzen kriegst du durch Aufgaben. Auf dem Schwarzmarkt kannst du damit die verrücktesten Pflanzen anderer Spieler kaufen!" },
        { keys: ["selbst erstellen", "eigene pflanze"], answer: "Geh zum Schwarzmarkt Tab (das Totenkopf-Icon 💀). Dort kannst du für 50 Gems pro Stück deine eigenen Kreationen anbieten!" }
    ];

    const handleSend = async () => {
        if(!input.trim()) return;
        const userText = input;
        setMessages(p => [...p, { role: 'user', text: userText }]);
        setInput("");
        setIsTyping(true);

        try {
            // Check if process/API key is available before trying to use SDK
            if (!process?.env?.API_KEY) throw new Error("Kein API Key");

            // 1. Kontext sammeln (Daten für die KI)
            const inventoryItems = Object.entries(roomData.inventory || {})
                .filter(([_, count]) => (count as number) > 0)
                .map(([id, count]) => `${count}x ${id.replace('_seed', '').replace('_', ' ')}`)
                .join(', ') || "Leer";

            const plantedCount = Object.values(roomData.gardens || {}).reduce((acc: number, garden: any) => {
                return acc + Object.values(garden).filter((cell: any) => cell.item).length;
            }, 0);

            const contextData = {
                playerName: user.displayName,
                gardenName: roomData.roomName,
                coins: roomData.coins,
                gems: roomData.gems,
                streak: roomData.currentStreak,
                inventory: inventoryItems,
                plantedPlants: plantedCount,
                unlockedAreas: roomData.unlockedGardens?.length || 1,
                lastLogin: new Date().toLocaleTimeString()
            };

            // 2. Gemini API aufrufen
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: userText,
                config: {
                    systemInstruction: `Du bist Octo, ein fröhlicher, intelligenter Oktopus-Gärtner 🐙. 
                    Du hilfst dem Spieler in der App 'DuoBloom'.
                    Sprich Deutsch. Sei kurz, prägnant und lustig (nutze Emojis wie 🐙, 🌿, 💧).
                    
                    AKTUELLE SPIELER-DATEN:
                    ${JSON.stringify(contextData, null, 2)}
                    
                    REGELN & TIPPS:
                    - Pflanzen wachsen nur, wenn man sie alle 6h gießt.
                    - Gems (💎) sind selten. Man kriegt sie selten beim Ernten oder durch Aufgaben.
                    - Münzen (💰) braucht man für Seeds im Shop.
                    - Schwarzmarkt: Man kann für 50 Gems eigene Pflanzen erstellen.
                    
                    Wenn der Spieler fragt "Was soll ich tun?", schau auf sein Inventar oder Münzen und gib einen passenden Tipp.
                    Wenn er fragt "Wie viel Geld habe ich?", antworte basierend auf den Daten.
                    `
                }
            });

            setMessages(p => [...p, { role: 'model', text: response.text }]);

        } catch (e) {
            console.warn("AI Error, falling back to local logic", e);
            // Fallback auf die alte Logik, falls API failt
            setTimeout(() => {
                const t = userText.toLowerCase();
                const hit = OCTO_KNOWLEDGE.find(k => k.keys.some(key => t.includes(key)));
                const reply = hit ? hit.answer : "Blub? 🫧 Das Wasser ist heute trüb (Verbindungsproblem). Aber ich bin sicher, du machst das toll! 🐙";
                setMessages(p => [...p, { role: 'model', text: reply }]);
            }, 800);
        } finally {
            setIsTyping(false);
        }
    };

    React.useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isOpen]);

    return (
        <>
            <button onClick={() => setIsOpen(true)} className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 bg-white p-2 rounded-full shadow-xl border-4 border-purple-200 animate-bounce hover:scale-110 transition-transform group">
                <img src={OCTO_IMG} className="w-10 h-10 group-hover:rotate-12 transition-transform" alt="Octo" />
            </button>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center pointer-events-none">
                    <div className="bg-white w-full md:w-[380px] h-[60vh] md:h-[500px] md:rounded-3xl shadow-2xl flex flex-col pointer-events-auto animate-pop border m-0 md:m-4 overflow-hidden">
                        <div className="bg-purple-600 p-4 text-white flex justify-between items-center shadow-md">
                            <div className="flex items-center gap-3"><img src={OCTO_IMG} className="w-8 h-8"/> <span className="font-bold">Octo AI</span></div>
                            <button onClick={() => setIsOpen(false)}><Icon name="x" size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                            {messages.map((m, i) => (
                                <div key={i} className={`p-3 rounded-2xl text-sm max-w-[80%] ${m.role === 'user' ? 'bg-purple-600 text-white ml-auto rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'}`}>{m.text}</div>
                            ))}
                            {isTyping && <div className="text-gray-400 text-xs ml-2">Octo denkt nach... 🫧</div>}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-3 bg-white border-t flex gap-2">
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Frag Octo..." className="flex-1 bg-gray-100 rounded-xl px-4 py-2 outline-none" />
                            <button onClick={handleSend} disabled={isTyping} className="bg-purple-600 text-white p-2 rounded-xl disabled:bg-gray-300"><Icon name="send" size={20}/></button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// --- BLACK MARKET COMPONENT ---

const BlackMarket = ({ roomData, roomCode, user }) => {
    const [listings, setListings] = React.useState<any[]>([]);
    const [isCreating, setIsCreating] = React.useState(false);
    
    // New Item Form State
    const [newName, setNewName] = React.useState("");
    const [newIcon, setNewIcon] = React.useState("🌿");
    const [newStages, setNewStages] = React.useState(3);
    const [newPrice, setNewPrice] = React.useState(100);
    const [newSupply, setNewSupply] = React.useState(5);
    const [creatingStep, setCreatingStep] = React.useState(false);
    const [permissionError, setPermissionError] = React.useState(false);

    React.useEffect(() => {
        setPermissionError(false);
        const q = query(collectionGroup(db, 'blackMarket'), limit(50));
        
        const unsub = onSnapshot(q, (snap) => {
            const l = snap.docs.map(d => {
                const data = d.data();
                return { id: d.id, ...data, path: d.ref.path }; 
            }).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            
            setListings(l);
        }, (error) => {
            console.error("BlackMarket Snapshot Error:", error);
            if(error.code === 'permission-denied') setPermissionError(true);
            
            try {
                 const localQ = query(collection(db, 'rooms', roomCode, 'blackMarket'), limit(20));
                 getDocs(localQ).then(sn => {
                     setListings(sn.docs.map(d => ({id:d.id, ...d.data(), path: d.ref.path})));
                 });
            } catch(e){}
        });
        return () => unsub();
    }, [roomCode]);

    const handleCreateListing = async () => {
        try {
            setPermissionError(false);
            const supplyVal = Math.max(1, parseInt(String(newSupply), 10) || 1);
            const gemCost = supplyVal * 50;
            const priceVal = Math.max(0, parseInt(String(newPrice), 10) || 0);
            const stagesVal = Math.max(1, parseInt(String(newStages), 10) || 1);
            
            if (!roomData) throw new Error("Keine Raumdaten geladen.");
            if ((roomData.gems || 0) < gemCost) throw new Error(`Nicht genug Gems! Du hast ${roomData.gems}, brauchst ${gemCost}.`);
            if (!newName.trim()) throw new Error("Bitte einen Namen eingeben.");

            setCreatingStep(true);

            // 1. Deduct Gems from CURRENT room
            const roomRef = doc(db, 'rooms', roomCode);
            await updateDoc(roomRef, {
                gems: increment(-gemCost)
            });

            // 2. Create Listing in CURRENT ROOM's subcollection
            await addDoc(collection(db, 'rooms', roomCode, 'blackMarket'), {
                creatorId: user.uid,
                creatorName: user.displayName || 'Unbekannt',
                creatorRoom: roomCode,
                name: newName.trim(),
                icon: newIcon.trim() || '📦',
                stages: stagesVal,
                price: priceVal,
                supply: supplyVal,
                maxSupply: supplyVal,
                createdAt: new Date().toISOString(),
                type: 'seed',
                growsInto: 'custom',
                reward: 10 
            });

            setIsCreating(false);
            setNewName(""); 
            setNewPrice(100); 
            setNewSupply(5);
            setNewIcon("🌿");
            alert("Angebot erfolgreich erstellt!");
        } catch(e: any) {
            console.error("Blackmarket Error:", e);
            if (e.code === 'permission-denied') {
                setPermissionError(true);
            } else {
                alert("Fehler: " + (e.message || e));
            }
        } finally {
            setCreatingStep(false);
        }
    };

    const handleBuy = async (listing) => {
        if (listing.supply <= 0) return alert("Ausverkauft!");
        if (roomData.coins < listing.price) return alert("Nicht genug Münzen!");
        if (listing.creatorRoom === roomCode) return alert("Du kannst nicht deine eigenen Sachen kaufen!");

        try {
            const revenue = Math.floor(listing.price * 0.6);

            await updateDoc(doc(db, 'rooms', roomCode), {
                coins: increment(-listing.price),
                [`inventory.${listing.id}`]: increment(1),
                [`customDefinitions.${listing.id}`]: {
                    id: listing.id,
                    name: listing.name,
                    icon: listing.icon,
                    stages: listing.stages,
                    type: 'seed',
                    reward: listing.reward || 10,
                    price: listing.price 
                }
            });

            try {
                const sellerItemRef = doc(db, 'rooms', listing.creatorRoom, 'blackMarket', listing.id);
                await updateDoc(sellerItemRef, {
                    supply: increment(-1)
                });
            } catch(e: any) {
                console.warn("Update seller failed:", e);
                if(e.code === 'permission-denied') {
                    setPermissionError(true);
                    return; // Stop here if permissions are broken
                }
            }

            try {
                if (listing.creatorRoom) {
                    await updateDoc(doc(db, 'rooms', listing.creatorRoom), {
                        coins: increment(revenue)
                    });
                }
            } catch(e) { console.warn("Seller payment failed", e); }
            
            alert("Gekauft!");

        } catch(e) {
            console.error(e);
            alert("Kauf fehlgeschlagen.");
        }
    };

    if (permissionError) {
        return (
            <div className="p-6 bg-red-50 border-2 border-red-200 rounded-3xl m-4 animate-pop">
                <h3 className="text-red-600 font-bold text-lg mb-2 flex items-center gap-2"><Icon name="alert-triangle"/> Firebase Regeln aktualisieren</h3>
                <p className="text-sm text-red-800 mb-4">
                    Deine Datenbank erlaubt diese Aktion nicht. Um den Schwarzmarkt zu nutzen, musst du die Sicherheitsregeln anpassen.
                </p>
                <div className="bg-white p-3 rounded-xl border border-red-100 font-mono text-xs overflow-x-auto mb-4 text-gray-600">
                    <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}</pre>
                </div>
                <div className="text-xs text-gray-500 mb-4">
                    Geh zur <strong>Firebase Console</strong> &rarr; <strong>Firestore</strong> &rarr; <strong>Regeln</strong> und füge diesen Code ein.
                </div>
                <button onClick={() => setPermissionError(false)} className="bg-red-600 text-white font-bold py-2 px-4 rounded-xl w-full hover:bg-red-700">Verstanden</button>
            </div>
        );
    }

    return (
        <div className="p-6 md:max-w-4xl md:mx-auto pb-32">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><span className="text-3xl">💀</span> Schwarzmarkt</h2>
                    <p className="text-xs text-slate-500">Erstelle Pflanzen, verdiene mit. (Verdienst: 60%)</p>
                </div>
                <button onClick={() => setIsCreating(true)} className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-black transition-colors">
                    <Icon name="plus" /> Angebot
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map(l => (
                    <div key={l.id} className={`p-4 rounded-2xl border-2 flex items-center justify-between ${l.supply > 0 ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-100 opacity-60'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-4xl shadow-inner">
                                {l.icon}
                            </div>
                            <div>
                                <div className="font-bold text-lg">{l.name}</div>
                                <div className="text-xs text-gray-500 mb-1">von {l.creatorName}</div>
                                <div className="flex gap-2 text-xs font-mono">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">Stufen: {l.stages}</span>
                                    <span className={`px-1.5 py-0.5 rounded font-bold ${l.supply > 0 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>Vorrat: {l.supply}/{l.maxSupply}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className="font-black text-xl text-yellow-600">{l.price} 💰</span>
                            <button onClick={() => handleBuy(l)} disabled={l.supply <= 0 || roomData.coins < l.price} className="bg-slate-800 disabled:bg-slate-300 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-700 active:scale-95 transition-all">
                                {l.supply > 0 ? 'Kaufen' : 'Leer'}
                            </button>
                        </div>
                    </div>
                ))}
                {listings.length === 0 && <div className="col-span-full text-center py-10 text-gray-400 italic">Der Schwarzmarkt ist leer. Sei der Erste!</div>}
            </div>

            {isCreating && (
                <Modal title="Illegales Angebot erstellen" onClose={() => setIsCreating(false)}>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
                                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Exotische Pflanze" className="w-full border-2 border-slate-200 rounded-xl p-2 outline-none focus:border-slate-800" />
                            </div>
                            <div className="w-20">
                                <label className="text-xs font-bold text-gray-500 uppercase">Icon</label>
                                <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="🍄" className="w-full border-2 border-slate-200 rounded-xl p-2 text-center outline-none focus:border-slate-800" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Preis (Münzen)</label>
                                <input type="number" value={newPrice} onChange={e => setNewPrice(parseInt(e.target.value) || 0)} className="w-full border-2 border-slate-200 rounded-xl p-2 outline-none focus:border-slate-800" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Phasen</label>
                                <input type="number" min="1" max="10" value={newStages} onChange={e => setNewStages(parseInt(e.target.value) || 1)} className="w-full border-2 border-slate-200 rounded-xl p-2 outline-none focus:border-slate-800" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Verkaufsmenge (Supply)</label>
                            <input type="range" min="1" max="20" value={newSupply} onChange={e => setNewSupply(parseInt(e.target.value) || 1)} className="w-full accent-slate-800" />
                            <div className="flex justify-between text-sm mt-1">
                                <span>{newSupply} Stück</span>
                                <span className="font-bold text-purple-600">Kosten: {newSupply * 50} 💎</span>
                            </div>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded-xl text-xs text-yellow-800 border border-yellow-200">
                            Du erhältst <strong>{Math.floor((parseInt(String(newPrice))||0) * 0.6)} Münzen</strong> pro Verkauf.
                        </div>
                        <button onClick={handleCreateListing} disabled={creatingStep || roomData.gems < (newSupply * 50)} className="w-full bg-slate-800 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors">
                            {creatingStep ? 'Wird geschmuggelt...' : `Angebot erstellen (-${newSupply * 50} 💎)`}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- SCREENS ---
const CommunityList = ({ onVisit, onBack }) => {
    const [list, setList] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    React.useEffect(() => {
        const timer = setTimeout(() => { try { if((window as any).lucide) (window as any).lucide.createIcons(); } catch(e) {} }, 100);
        const fetchG = async () => { try { const q = query(collection(db, 'rooms'), limit(50)); const snap = await getDocs(q); const sorted = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => (b.likes||0) - (a.likes||0)); setList(sorted); } catch(e) { console.error(e); } setLoading(false); }; fetchG();
        return () => clearTimeout(timer);
    }, []);
    React.useEffect(() => { const t = setTimeout(() => { try { if((window as any).lucide) (window as any).lucide.createIcons(); } catch(e) {} }, 100); return () => clearTimeout(t); }, [list]);
    return (
        <div className="h-full bg-slate-50 flex flex-col md:max-w-4xl md:mx-auto md:my-8 md:rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 bg-white shadow-sm flex items-center gap-4"><button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><Icon name="home" className="text-gray-600"/></button><h2 className="text-2xl font-bold text-gray-800">Community Gärten</h2></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {loading && <div>Lade Liste...</div>}
                {list.map(g => (<div key={g.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition-shadow"><div><div className="font-bold text-lg text-gray-800">{g.roomName || "Unbenannter Garten"}</div><div className="text-sm text-gray-500 flex gap-3"><span className="text-red-500 flex items-center gap-1"><Icon name="heart" size={12}/> {g.likes||0}</span><span>Level {g.unlockedGardens?.length || 1}</span></div></div><button onClick={() => onVisit(g.id)} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold hover:bg-purple-200">Besuchen</button></div>))}
            </div>
        </div>
    );
};

const MainMenu = ({ user, onAction, currentRoom }) => {
    const [joinCode, setJoinCode] = React.useState("");
    const [isCreating, setIsCreating] = React.useState(false);
    const [newGardenName, setNewGardenName] = React.useState("");
    const [isBusy, setIsBusy] = React.useState(false);
    const [streak, setStreak] = React.useState(0);

    React.useEffect(() => { 
        if((window as any).lucide) try{(window as any).lucide.createIcons();}catch(e){}
        if(currentRoom && db) {
            const unsub = onSnapshot(doc(db, 'rooms', currentRoom), (snap) => {
                if(snap.exists()) {
                    const data = snap.data();
                    const today = new Date().toISOString().split('T')[0];
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    
                    let s = data.currentStreak || 0;
                    const last = data.lastStreakDate;
                    if (last !== today && last !== yesterday) s = 0; 
                    setStreak(s);
                }
            }, (err) => console.log("Streak error", err));
            return () => unsub();
        }
    }, [currentRoom]);

    const handleCreate = async () => {
        if(!newGardenName.trim()) return alert("Bitte Namen eingeben");
        setIsBusy(true);
        await onAction('create', null, newGardenName);
        setIsBusy(false);
        setIsCreating(false);
    };

    return (
        <div className="h-full bg-slate-100 flex flex-col md:flex-row max-w-5xl mx-auto shadow-xl md:rounded-3xl md:my-8 overflow-hidden">
            <div className="bg-white p-6 flex flex-col items-center border-b md:border-b-0 md:border-r border-gray-100 shadow-sm z-10 md:w-1/3 flex-shrink-0">
                <div className="flex items-center gap-4 w-full md:flex-col">
                    <img src={user.photoURL} className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-green-50 shadow-lg" />
                    <div className="text-left md:text-center"><h1 className="text-xl md:text-2xl font-bold text-gray-800">{user.displayName}</h1><p className="text-xs text-gray-400">ID: {user.uid.slice(0,5)}</p></div>
                    <button onClick={() => auth.signOut()} className="ml-auto md:ml-0 md:mt-auto text-red-500 font-bold bg-red-50 p-2 rounded-lg"><Icon name="log-out" /></button>
                </div>
                <div className="hidden md:flex flex-col w-full space-y-2 mt-8">
                    <button onClick={() => onAction('community')} className="w-full bg-purple-50 border border-purple-200 p-3 rounded-xl text-purple-700 font-bold flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors"><Icon name="globe" /> Community</button>
                </div>
            </div>
            <div className="flex-1 bg-[#f8fafc] p-6 flex flex-col gap-6 overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-700">Dashboard</h2>
                {currentRoom && (
                    <div className={`bg-gradient-to-r ${getStreakStyle(streak)} w-full flex-shrink-0 p-6 rounded-3xl shadow-lg flex items-center justify-between text-white relative overflow-hidden mb-4 min-h-[120px] transition-all duration-500`}>
                        <div className="z-10 relative">
                            <div className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">Dein Streak</div>
                            <div className="text-4xl font-black flex items-baseline gap-2">{streak} <span className="text-base font-medium opacity-90">Tage</span></div>
                            <div className="text-xs font-medium opacity-80 mt-1">{streak === 0 ? "Fang heute an!" : "Bleib dran! 🔥"}</div>
                        </div>
                        <div className="text-6xl animate-pulse z-10 drop-shadow-md transform translate-x-2">🔥</div>
                    </div>
                )}
                {currentRoom ? (
                    <button onClick={() => onAction('resume', currentRoom)} className="bg-white border-2 border-green-500 text-green-600 p-6 rounded-2xl shadow-sm hover:bg-green-50 transition-all text-left flex items-center justify-between group flex-shrink-0">
                        <div><div className="text-green-800 text-sm font-bold uppercase mb-1">Letzte Sitzung</div><div className="text-2xl font-bold">Weitergärtnern</div><div className="text-sm opacity-80 font-mono mt-1">Code: {currentRoom}</div></div>
                        <div className="bg-green-100 p-3 rounded-full"><Icon name="play" className="text-green-600" /></div>
                    </button>
                ) : <div className="bg-gray-100 p-4 rounded-xl text-center text-gray-500 italic flex-shrink-0">Kein Garten besucht.</div>}
                <hr className="border-gray-200" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                    <button onClick={() => setIsCreating(true)} className="bg-white border-2 border-dashed border-gray-300 p-6 rounded-2xl text-gray-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 h-32 flex-shrink-0"><div className="bg-blue-100 p-3 rounded-full text-blue-500"><Icon name="plus" /></div><span className="font-bold">Neuer Garten</span></button>
                    <div className="bg-white border border-gray-200 p-6 rounded-2xl flex flex-col justify-center h-32 flex-shrink-0"><label className="text-xs font-bold text-gray-400 uppercase mb-2">Code eingeben</label><div className="flex gap-2"><input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="CODE" className="w-full bg-gray-100 rounded-lg px-3 py-2 font-bold uppercase focus:ring-2 ring-blue-500 outline-none" /><button onClick={() => joinCode && onAction('join', joinCode)} className="bg-blue-500 text-white px-3 rounded-lg font-bold hover:bg-blue-600 transition-colors"><Icon name="arrow-right" /></button></div></div>
                    <button onClick={() => onAction('community')} className="md:hidden bg-purple-50 border border-purple-200 p-4 rounded-2xl text-purple-700 font-bold flex items-center justify-center gap-2 hover:bg-purple-100 flex-shrink-0"><Icon name="globe" /> Community</button>
                </div>
            </div>
            {isCreating && (
                <Modal title="Garten benennen" onClose={() => !isBusy && setIsCreating(false)}><div className="space-y-4"><input autoFocus value={newGardenName} onChange={e => setNewGardenName(e.target.value)} placeholder="Name..." className="w-full border rounded-xl p-3 outline-none" disabled={isBusy} /><button onClick={handleCreate} disabled={isBusy} className={`w-full text-white font-bold py-3 rounded-xl ${isBusy ? 'bg-gray-400' : 'bg-green-500'}`}>{isBusy ? '...' : 'Erstellen'}</button></div></Modal>
            )}
        </div>
    );
};

// --- GAME SCREEN ---

const GameScreen = ({ user, roomCode, roomData, onBack }) => {
    const [items, setItems] = React.useState(BASE_ITEMS);
    const [selectedItem, setSelectedItem] = React.useState<string | null>(null);
    const [activeGarden, setActiveGarden] = React.useState(0);
    const [shopOpen, setShopOpen] = React.useState(false);
    const [bmOpen, setBmOpen] = React.useState(false);

    React.useEffect(() => {
        if (roomData.customDefinitions) {
            setItems(prev => ({ ...BASE_ITEMS, ...roomData.customDefinitions }));
        }
    }, [roomData.customDefinitions]);

    // Update streak logic
    React.useEffect(() => {
        const updateStreak = async () => {
             const today = new Date().toISOString().split('T')[0];
             const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
             const last = roomData.lastStreakDate;
             if (last === today) return;

             let s = roomData.currentStreak || 0;
             if (last === yesterday) s++; else s = 1;
             
             await updateDoc(doc(db, 'rooms', roomCode), {
                 currentStreak: s,
                 lastStreakDate: today
             });
        };
        updateStreak();
    }, [roomCode]); 

    const handleGridClick = async (x, y) => {
        const cellKey = `${x},${y}`;
        const garden = roomData.gardens?.[activeGarden] || {};
        const cell = garden[cellKey] || {};

        if (cell.item) {
             const item = items[cell.item];
             if (!item) return; 
             if (item.type === 'seed') {
                 if (cell.grown) {
                     const reward = item.reward || 10;
                     const dropGem = Math.random() < 0.05 ? 1 : 0;
                     await updateDoc(doc(db, 'rooms', roomCode), {
                         coins: increment(reward),
                         gems: increment(dropGem),
                         [`gardens.${activeGarden}.${cellKey}`]: deleteField()
                     });
                 } else {
                     const lastWatered = cell.lastWatered ? new Date(cell.lastWatered).getTime() : 0;
                     if (Date.now() - lastWatered > WATER_COOLDOWN) {
                         const nextStage = (cell.stage || 0) + 1;
                         await updateDoc(doc(db, 'rooms', roomCode), {
                             [`gardens.${activeGarden}.${cellKey}.lastWatered`]: new Date().toISOString(),
                             [`gardens.${activeGarden}.${cellKey}.stage`]: nextStage,
                             [`gardens.${activeGarden}.${cellKey}.grown`]: nextStage >= item.stages
                         });
                     } else {
                         alert("Pflanze ist noch feucht!");
                     }
                 }
             } else if (item.type === 'deco') {
                 if (confirm("Item aufnehmen?")) {
                      await updateDoc(doc(db, 'rooms', roomCode), {
                         [`gardens.${activeGarden}.${cellKey}`]: deleteField(),
                         [`inventory.${cell.item}`]: increment(1)
                     });
                 }
             }
        } else if (selectedItem) {
            const item = items[selectedItem];
            const count = roomData.inventory?.[selectedItem] || 0;
            if (count > 0) {
                 const isFloor = item.type === 'floor';
                 const update = { [`inventory.${selectedItem}`]: increment(-1) };
                 if (isFloor) update[`gardens.${activeGarden}.${cellKey}.floor`] = selectedItem;
                 else update[`gardens.${activeGarden}.${cellKey}`] = { item: selectedItem, stage: 0, lastWatered: 0, grown: false };
                 
                 await updateDoc(doc(db, 'rooms', roomCode), update);
            } else {
                alert("Nicht genug im Inventar!");
            }
        }
    };

    const buy = async (id) => {
        const price = items[id].price;
        if (roomData.coins >= price) {
            await updateDoc(doc(db, 'rooms', roomCode), {
                coins: increment(-price),
                [`inventory.${id}`]: increment(1)
            });
        } else alert("Nicht genug Münzen!");
    };

    return (
        <div className="h-full flex flex-col bg-slate-800 text-white overflow-hidden">
            <div className="p-4 bg-white/10 backdrop-blur-md flex justify-between items-center z-10 shadow-lg">
                <div className="flex items-center gap-4">
                    <button onClick={onBack}><Icon name="arrow-left" /></button>
                    <div>
                        <div className="font-bold">{roomData.roomName}</div>
                        <div className="text-xs text-slate-300 flex gap-3">
                            <span className="text-yellow-400 font-bold">{roomData.coins} 💰</span>
                            <span className="text-purple-400 font-bold">{roomData.gems} 💎</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setBmOpen(true)} className="p-2 bg-slate-900 rounded-xl border border-slate-700"><Icon name="skull"/></button>
                    <button onClick={() => setShopOpen(true)} className="p-2 bg-green-600 rounded-xl border border-green-500 shadow-lg"><Icon name="shopping-cart"/></button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex justify-center items-center relative">
                 <div className="relative p-6 rounded-3xl shadow-2xl border-4 border-[#3a5a2a] bg-[#5c8d41]" style={{backgroundImage: `url(${GARDEN_BG})`, backgroundSize: 'cover'}}>
                      <div className="grid grid-cols-6 gap-1 md:gap-2">
                           {Array.from({length: 36}).map((_, i) => {
                               const x = i % 6;
                               const y = Math.floor(i / 6);
                               const cell = roomData.gardens?.[activeGarden]?.[`${x},${y}`] || {};
                               return <GridCell key={i} x={x} y={y} cell={cell} handleGridClick={handleGridClick} now={Date.now()} items={items} />;
                           })}
                      </div>
                 </div>
            </div>

            <div className="bg-white/90 p-2 overflow-x-auto flex gap-2 z-10 border-t border-white/20 h-24 items-center">
                <button onClick={() => setSelectedItem(null)} className={`w-16 h-16 rounded-xl border-2 flex-shrink-0 flex items-center justify-center ${selectedItem === null ? 'border-red-500 bg-red-50 text-red-500' : 'border-slate-300 text-slate-400'}`}><Icon name="mouse-pointer"/></button>
                {Object.entries(roomData.inventory || {}).map(([id, count]) => {
                    if ((count as number) <= 0) return null;
                    const it = items[id];
                    if(!it) return null;
                    return (
                        <button key={id} onClick={() => setSelectedItem(id)} className={`relative w-16 h-16 rounded-xl border-2 flex-shrink-0 flex items-center justify-center overflow-hidden ${selectedItem === id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                            <ItemDisplay item={it} className="w-10 h-10" />
                            <span className="absolute bottom-0 right-1 text-xs font-bold text-slate-700 bg-white/80 px-1 rounded">{count as number}</span>
                        </button>
                    );
                })}
            </div>

            <OctoChat user={user} roomData={roomData} />

            {shopOpen && (
                <Modal title="Laden" onClose={() => setShopOpen(false)}>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.values(BASE_ITEMS).map((it: any) => (
                            <button key={it.id} onClick={() => buy(it.id)} className="border p-3 rounded-xl flex flex-col items-center hover:bg-slate-50">
                                <ItemDisplay item={it} className="w-12 h-12 mb-2"/>
                                <span className="font-bold text-slate-700 text-sm">{it.name}</span>
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded mt-1 font-bold">{it.price} 💰</span>
                            </button>
                        ))}
                    </div>
                </Modal>
            )}

            {bmOpen && (
                <div className="fixed inset-0 bg-white z-50 flex flex-col animate-pop">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <h2 className="font-bold text-lg">Schwarzmarkt</h2>
                        <button onClick={() => setBmOpen(false)}><Icon name="x"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <BlackMarket roomData={roomData} roomCode={roomCode} user={user} />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- APP COMPONENT ---

const App = () => {
    const [user, setUser] = React.useState(null);
    const [view, setView] = React.useState("menu");
    const [roomCode, setRoomCode] = React.useState(localStorage.getItem("lastRoom") || "");
    const [roomData, setRoomData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        return onAuthStateChanged(auth, u => {
            setUser(u);
            setLoading(false);
        });
    }, []);

    React.useEffect(() => {
        if (!user || !roomCode || view !== 'game') return;
        const unsub = onSnapshot(doc(db, 'rooms', roomCode), (d) => {
            if (d.exists()) setRoomData(d.data());
            else { alert("Garten existiert nicht!"); setView("menu"); }
        });
        return () => unsub();
    }, [user, roomCode, view]);

    const handleAction = async (action, code, name) => {
        if (action === 'create') {
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            await setDoc(doc(db, 'rooms', newCode), {
                roomName: name, creatorId: user.uid, coins: 100, gems: 5, 
                inventory: { carrot_seed: 5, water_bucket: 1 },
                gardens: { 0: {} }, unlockedGardens: [0], createdAt: new Date().toISOString(), likes: 0,
                currentStreak: 0, lastStreakDate: ''
            });
            setRoomCode(newCode); localStorage.setItem("lastRoom", newCode); setView("game");
        } else if (action === 'join' || action === 'resume') {
            setRoomCode(code); localStorage.setItem("lastRoom", code); setView("game");
        } else if (action === 'community') {
            setView("community");
        }
    };

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-100">Lade DuoBloom...</div>;

    if (!user) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-green-100 p-6">
            <h1 className="text-5xl font-black text-green-800 mb-2 tracking-tighter">DuoBloom 🌸</h1>
            <p className="text-green-700 mb-8 font-medium">Dein gemeinsamer Garten wartet.</p>
            <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="bg-white px-8 py-4 rounded-2xl shadow-xl flex items-center gap-4 font-bold text-gray-700 hover:scale-105 transition-transform">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6"/>
                Mit Google anmelden
            </button>
        </div>
    );

    if (view === 'community') return <CommunityList onVisit={(id) => { setRoomCode(id); setView("game"); }} onBack={() => setView("menu")} />;
    if (view === 'game' && roomData) return <GameScreen user={user} roomCode={roomCode} roomData={roomData} onBack={() => setView("menu")} />;
    
    return <MainMenu user={user} currentRoom={roomCode} onAction={handleAction} />;
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
