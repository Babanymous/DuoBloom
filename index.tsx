// NEU (EINFÜGEN):
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, getDoc, getDocs, addDoc, arrayUnion, increment, deleteField, query, limit, orderBy, collectionGroup } from "firebase/firestore";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Falls du die KI schon drin hast

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

// --- OCTO CHAT MIT GEMINI ---

const OctoChat = ({ user, roomData }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    // Startnachricht
    const [messages, setMessages] = React.useState([
        { role: 'model', text: `Blub Blub! 🐙 Hallo ${user.displayName?.split(' ')[0] || 'Freund'}! Ich bin Octo. Frag mich alles über deinen Garten!` }
    ]);
    const [input, setInput] = React.useState("");
    const [isTyping, setIsTyping] = React.useState(false);
    const messagesEndRef = React.useRef(null);

    // HIER DEINEN API KEY EINFÜGEN
    // Vite nutzt import.meta.env, Create-React-App nutzt process.env
    const API_KEY = import.meta.env.VITE_GEMINI_KEY; 


    const handleSend = async () => {
        if(!input.trim()) return;
        const userText = input;
        
        // 1. User Nachricht sofort anzeigen
        setMessages(p => [...p, { role: 'user', text: userText }]);
        setInput("");
        setIsTyping(true);

        try {
            // 2. Gemini initialisieren
            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


            // 3. Octos Persönlichkeit definieren (System Prompt)
            // Wir geben ihm Kontext über das Spiel und seine Rolle
            const contextPrompt = `
                Du bist Octo, ein freundlicher, hilfsbereiter Oktopus, der in einem Garten-Spiel lebt.
                Deine Persönlichkeit:
                - Du sagst oft "Blub Blub" oder benutzt Oktopus/Wasser Emojis 🐙 💧.
                - Du bist witzig und motivierend.
                - Du fasst dich kurz (max 2-3 Sätze).
                
                Wissen über das Spiel:
                - Es gibt Pflanzen wie Karotten (schnell), Sonnenblumen und Vergissmeinnicht.
                - Pflanzen muss man alle 6 Stunden gießen.
                - Auf dem Schwarzmarkt (Totenkopf-Icon) kann man eigene Pflanzen gegen Gems verkaufen.
                - Gems (Edelsteine) sind selten, Münzen sind häufig.
                
                Der Spieler fragt: "${userText}"
                Antworte als Octo:
            `;

            // 4. Anfrage an die KI
            const result = await model.generateContent(contextPrompt);
            const response = result.response.text();

            // 5. Antwort anzeigen
            setMessages(p => [...p, { role: 'model', text: response }]);

        } catch (error) {
            console.error("Gemini Error:", error);
            setMessages(p => [...p, { role: 'model', text: "Blub? Mein Kopf tut weh... (API Fehler) 😵‍💫" }]);
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
                            <div className="flex items-center gap-3"><img src={OCTO_IMG} className="w-8 h-8"/> <span className="font-bold">Octo KI</span></div>
                            <button onClick={() => setIsOpen(false)}><Icon name="x" size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                            {messages.map((m, i) => (
                                <div key={i} className={`p-3 rounded-2xl text-sm max-w-[80%] ${m.role === 'user' ?
                                'bg-purple-600 text-white ml-auto rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'}`}>{m.text}</div>
                            ))}
                            {isTyping && <div className="text-gray-400 text-xs ml-2 animate-pulse">Octo denkt nach... 🫧</div>}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-3 bg-white border-t flex gap-2">
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Frag Octo..." className="flex-1 bg-gray-100 rounded-xl px-4 py-2 outline-none" />
                            <button onClick={handleSend} className="bg-purple-600 text-white p-2 rounded-xl"><Icon name="send" size={20}/></button>
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

            const calculatedReward = Math.floor(stagesVal / 2) * 10; 
            
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
                reward: calculatedReward
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
                    // NEU: Berechnung beim Kauf erzwingen
                    reward: Math.floor(listing.stages / 2) * 10, 
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
                    <img src={user.photoURL} className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-green-500 shadow-lg" />
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

const GameApp = ({ user, roomCode, isSpectator, onBackToMenu }) => {
    const [roomData, setRoomData] = React.useState(null);
    const [tab, setTab] = React.useState('garden');
    const [activeGardenIdx, setActiveGardenIdx] = React.useState(0);
    const [selectedItem, setSelectedItem] = React.useState(null);
    const [isTaskModalOpen, setTaskModalOpen] = React.useState(false);
    const [taskFilter, setTaskFilter] = React.useState('active'); 
    const [newTaskTitle, setNewTaskTitle] = React.useState("");
    const [newTaskReward, setNewTaskReward] = React.useState(15);
    const [newTaskType, setNewTaskType] = React.useState("once");
    const [newTaskDeadline, setNewTaskDeadline] = React.useState("");
    const [now, setNow] = React.useState(Date.now());
    const [hasLiked, setHasLiked] = React.useState(false);
    const [items, setItems] = React.useState(BASE_ITEMS);

    React.useEffect(() => {
        if(!roomCode || !db) return;
        const unsub = onSnapshot(doc(db, 'rooms', roomCode), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if(!data.tasks) data.tasks = [];
                if(!data.inventory) data.inventory = {};
                if(!data.gardens) data.gardens = { 0: {} };
                if(!data.unlockedGardens) data.unlockedGardens = [0];
                if(!data.customDefinitions) data.customDefinitions = {};
                
                // Merge base items with custom items bought from market
                const merged = { ...BASE_ITEMS, ...data.customDefinitions };
                setItems(merged);
                setRoomData(data);
            } else if (isSpectator) { alert("Raum nicht gefunden."); onBackToMenu(); }
        }, err => console.log("DB Error", err));
        if (localStorage.getItem(`liked_${roomCode}`)) setHasLiked(true);
        return () => unsub();
    }, [roomCode, isSpectator]);

    React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    React.useEffect(() => { const t = setTimeout(() => { if((window as any).lucide) try{(window as any).lucide.createIcons();}catch(e){} }, 100); return () => clearTimeout(t); }, [roomData, tab, taskFilter]);

    const getGardens = () => roomData?.gardens || { 0: {} };
    const getCurrentGrid = () => (getGardens()[activeGardenIdx] || {});
    const getInventory = () => roomData?.inventory || {};
    const getTasks = () => Array.isArray(roomData?.tasks) ? roomData.tasks : [];

    const handleLike = async () => { if(hasLiked || !isSpectator) return; await updateDoc(doc(db, 'rooms', roomCode), { likes: increment(1) }); localStorage.setItem(`liked_${roomCode}`, 'true'); setHasLiked(true); };
    
    const handleGridClick = async (x, y) => {
        if (isSpectator || !roomData) return;
        const key = `${x},${y}`;
        const cell = getCurrentGrid()[key] || {};
        const roomRef = doc(db, 'rooms', roomCode);
        const path = `gardens.${activeGardenIdx}.${key}`;

        if (selectedItem) {
            const itemDef = items[selectedItem];
            if(!itemDef) return;

            const invCount = getInventory()[selectedItem] || 0;
            if (invCount > 0) {
                if (itemDef.type === 'floor') { if (cell.item) return alert("Erst Pflanze entfernen!"); await updateDoc(roomRef, { [`${path}.floor`]: selectedItem, [`inventory.${selectedItem}`]: increment(-1) }); }
                else if (itemDef.type === 'seed' && !cell.floor && !cell.item) await updateDoc(roomRef, { [`${path}.item`]: selectedItem, [`${path}.stage`]: 0, [`${path}.plantedAt`]: new Date().toISOString(), [`inventory.${selectedItem}`]: increment(-1) });
                else if (itemDef.type === 'deco' && !cell.item) await updateDoc(roomRef, { [`${path}.item`]: selectedItem, [`inventory.${selectedItem}`]: increment(-1) });
                if (invCount - 1 <= 0) setSelectedItem(null);
            }
            return;
        }
        if (cell.item) {
            const itemDef = items[cell.item];
            if(!itemDef) return; 
            if (cell.grown && itemDef.type === 'seed') { await updateDoc(roomRef, { [`${path}.item`]: deleteField(), [`${path}.stage`]: deleteField(), [`${path}.grown`]: deleteField(), gems: increment(itemDef.reward || 0) }); } 
            else if (itemDef.type === 'seed') { const lastWatered = cell.lastWatered ? new Date(cell.lastWatered).getTime() : 0; if (now - lastWatered > WATER_COOLDOWN) { const newStage = (cell.stage || 0) + 1; await updateDoc(roomRef, { [`${path}.stage`]: newStage, [`${path}.grown`]: newStage >= itemDef.stages, [`${path}.lastWatered`]: new Date().toISOString() }); } }
            else if (itemDef.type === 'deco') { if(confirm(`${itemDef.name} ins Inventar zurück?`)) { await updateDoc(roomRef, { [`${path}.item`]: deleteField(), [`inventory.${cell.item}`]: increment(1) }); } }
            return;
        }
        if (cell.floor) { const floorDef = items[cell.floor]; if(confirm(`${floorDef.name} aufheben?`)) { await updateDoc(roomRef, { [`${path}.floor`]: deleteField(), [`inventory.${cell.floor}`]: increment(1) }); } }
    };

    const createTask = async () => { if (!newTaskTitle.trim()) return; const task = { id: Date.now().toString(), title: newTaskTitle, reward: parseInt(newTaskReward as any), type: newTaskType, deadline: newTaskDeadline || null, done: false, lastDone: null, completedBy: null, completedAt: null, completedAtISO: null }; await updateDoc(doc(db, 'rooms', roomCode), { tasks: arrayUnion(task) }); setTaskModalOpen(false); setNewTaskTitle(""); };
    
    // --- STREAK LOGIC UPDATE ---
    const toggleTask = async (task) => { 
        if (isSpectator) return; 
        const d = new Date(); 
        const today = d.toISOString().split('T')[0]; 
        const nowStr = d.toLocaleString('de-DE'); 
        
        // Optimistic UI updates handled via Snapshot, here we prep DB updates
        let updates: any = { coins: increment(task.reward) };
        
        // Update Task List
        const updatedTasks = getTasks().map(t => { 
            if (t.id === task.id) { 
                return t.type === 'daily' ? { ...t, done: true, lastDone: today, completedBy: user.displayName, completedAt: nowStr } : { ...t, done: true, completedBy: user.displayName, completedAt: nowStr }; 
            } 
            return t; 
        });
        updates.tasks = updatedTasks;

        // --- STREAK CALCULATION ---
        const lastStreakDate = roomData.lastStreakDate;
        const currentStreak = roomData.currentStreak || 0;

        if (lastStreakDate !== today) {
             const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
             let newStreak = 1;
             
             if (lastStreakDate === yesterday) {
                 newStreak = currentStreak + 1;
             } 
             // If last streak was older than yesterday, it resets to 1 (which we initialized)
             
             updates.lastStreakDate = today;
             updates.currentStreak = newStreak;
        }

        await updateDoc(doc(db, 'rooms', roomCode), updates); 
    };

    const deleteTask = async (task) => { if(!confirm("Wirklich löschen?")) return; const newTasks = getTasks().filter(t => t.id !== task.id); await updateDoc(doc(db, 'rooms', roomCode), { tasks: newTasks }); };
    const buy = async (id, isGarden) => { if (isSpectator) return; if(isGarden) { const g = GARDEN_UPGRADES.find(x => x.id === id); if(roomData.gems >= g.price) await updateDoc(doc(db, 'rooms', roomCode), { gems: increment(-g.price), unlockedGardens: arrayUnion(id), [`gardens.${id}`]: {} }); } else { const item = items[id]; if (roomData.coins >= item.price) await updateDoc(doc(db, 'rooms', roomCode), { coins: increment(-item.price), [`inventory.${id}`]: increment(1) }); } };

    if (!roomData) return <div className="h-full flex items-center justify-center animate-pulse">Lade Garten...</div>;

    return (
        <div className={`flex h-full bg-slate-100 overflow-hidden md:max-w-7xl md:mx-auto md:my-8 md:rounded-3xl md:shadow-2xl md:border ${isSpectator ? 'border-purple-300 ring-4 ring-purple-100' : 'border-slate-200'}`}>
            <nav className="fixed bottom-0 left-0 w-full bg-white border-t z-40 flex justify-around p-2 pb-safe md:relative md:w-64 md:flex-col md:justify-start md:border-t-0 md:border-r md:p-6 md:gap-4">
                <div className="hidden md:block mb-8"><h1 className="text-2xl font-bold text-green-600 flex items-center gap-2"><Icon name="sprout"/> DuoBloom</h1>{isSpectator && <div className="bg-purple-100 text-purple-600 text-xs px-2 py-1 rounded mt-2 font-bold uppercase text-center">Zuschauer</div>}</div>
                <button onClick={() => setTab('garden')} className={`p-3 rounded-xl flex md:flex-row flex-col items-center gap-3 transition-all ${tab === 'garden' ? 'bg-green-50 text-green-600 font-bold' : 'text-gray-400 hover:bg-gray-50'}`}><Icon name="flower-2"/> <span className="text-[10px] md:text-sm">Garten</span></button>
                {!isSpectator && (
                    <>
                        <button onClick={() => setTab('tasks')} className={`p-3 rounded-xl flex md:flex-row flex-col items-center gap-3 transition-all ${tab === 'tasks' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-400 hover:bg-gray-50'}`}><Icon name="check-square"/> <span className="text-[10px] md:text-sm">Aufgaben</span></button>
                        <button onClick={() => setTab('shop')} className={`p-3 rounded-xl flex md:flex-row flex-col items-center gap-3 transition-all ${tab === 'shop' ? 'bg-orange-50 text-orange-600 font-bold' : 'text-gray-400 hover:bg-gray-50'}`}><Icon name="shopping-cart"/> <span className="text-[10px] md:text-sm">Shop</span></button>
                        <button onClick={() => setTab('blackmarket')} className={`p-3 rounded-xl flex md:flex-row flex-col items-center gap-3 transition-all ${tab === 'blackmarket' ? 'bg-slate-800 text-white font-bold' : 'text-gray-400 hover:bg-gray-50'}`}><Icon name="skull"/> <span className="text-[10px] md:text-sm">Schwarzmarkt</span></button>
                    </>
                )}
            </nav>
            <main className="flex-1 overflow-y-auto bg-[#eefcf3] relative pb-28 md:pb-0">
                <header className={`sticky top-0 backdrop-blur-md p-4 shadow-sm z-30 flex justify-between items-center px-6 ${isSpectator ? 'bg-purple-50/90' : 'bg-white/90'}`}>
                    <div className="flex items-center gap-4"><button onClick={onBackToMenu} className="bg-white border p-2 rounded-xl hover:bg-gray-100 shadow-sm" title="Zurück"><Icon name="home" className="text-gray-600"/></button><div className="flex flex-col"><span className="font-bold text-gray-700 truncate max-w-[150px] md:max-w-none text-lg">{roomData.roomName}</span><span className="text-[10px] text-gray-400 font-mono">{isSpectator ?'Gast-Ansicht' : `Code: ${roomCode}`}</span></div></div>
                    <div className="flex gap-4 ml-auto items-center">{isSpectator ? <button onClick={handleLike} className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold transition-all ${hasLiked ? 'bg-red-100 text-red-500' : 'bg-white border hover:bg-red-50 text-gray-500'}`}><Icon name="heart" className={hasLiked ? "fill-red-500" : ""}/> {roomData.likes || 0}</button> : <div className="flex flex-col items-end"><span className="font-bold text-yellow-600 text-lg flex items-center gap-1">💰 {roomData.coins}</span><span className="font-bold text-purple-600 text-lg flex items-center gap-1">💎 {roomData.gems}</span></div>}</div>
                </header>
                
                {tab === 'garden' && (
                    <div className="p-4 md:p-8 flex flex-col items-center">
                        <div className="flex gap-2 mb-4 overflow-x-auto w-full justify-center">{GARDEN_UPGRADES.map(g => { const owned = (roomData.unlockedGardens || []).includes(g.id); if(!owned) return null; return <button key={g.id} onClick={() => setActiveGardenIdx(g.id)} className={`px-4 py-1 rounded-full text-sm font-bold border ${activeGardenIdx === g.id ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-700 border-green-200'}`}>{g.name}</button> })}</div>
                        <div className="p-4 rounded-xl shadow-2xl relative inline-block bg-cover bg-center" style={{ backgroundImage: `url(${GARDEN_BG})`, backgroundColor: '#5c4033' }}>
                            <div className="grid grid-cols-5 gap-0 border-2 border-black/10 shadow-inner">
                                {Array.from({ length: 25 }).map((_, i) => ( <GridCell key={i} x={i%5} y={Math.floor(i/5)} cell={(getGardens()[activeGardenIdx] || {})[`${i%5},${Math.floor(i/5)}`] || {}} handleGridClick={handleGridClick} now={now} items={items} /> ))}
                            </div>
                        </div>
                        {!isSpectator && <div className="mt-8 w-full max-w-2xl bg-white p-4 rounded-2xl shadow-lg border border-gray-100"><h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Werkzeugkasten</h3><div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">{Object.entries(getInventory()).map(([id, count]) => { if ((count as number) <= 0) return null; return <button key={id} onClick={() => setSelectedItem(selectedItem === id ? null : id)} className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl border-2 transition-all min-w-[80px] ${selectedItem === id ? 'border-blue-500 bg-blue-50 shadow-md transform -translate-y-1' : 'border-gray-100 hover:bg-gray-50'}`}><ItemDisplay item={items[id] || {name:'?', icon:'❓'}} className="w-8 h-8" /><span className="text-xs font-bold text-gray-600">{String(count)}x</span></button> })}</div></div>}
                    </div>
                )}

                {tab === 'tasks' && !isSpectator && (
                    <div className="p-6 md:max-w-3xl md:mx-auto">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-700">Aufgaben</h2><button onClick={() => setTaskModalOpen(true)} className="bg-blue-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2"><Icon name="plus" /> Neu</button></div>
                        <div className="flex gap-2 mb-4 bg-white p-1 rounded-xl w-fit border border-gray-200"><button onClick={() => setTaskFilter('active')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${taskFilter === 'active' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>Offen</button><button onClick={() => setTaskFilter('done')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${taskFilter === 'done' ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>Erledigt</button></div>
                        <div className="space-y-3 pb-12">
                            {getTasks().filter(task => { const today = new Date().toISOString().split('T')[0]; const isDoneToday = task.type === 'daily' && task.lastDone === today; const isDoneEver = task.type === 'once' && task.done; return taskFilter === 'active' ? (!isDoneEver && !isDoneToday) : (isDoneEver || isDoneToday); }).map(task => (
                                <div key={task.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${taskFilter === 'done' ? 'border-green-100 opacity-80' : 'border-gray-100'} flex justify-between items-center`}>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2"><span className={`font-bold text-lg ${taskFilter === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</span>{task.type === 'daily' && <span className="text-blue-500"><Icon name="repeat" size={14}/></span>}</div>
                                        <div className="flex gap-3 text-xs">{taskFilter === 'done' ? <span className="text-gray-500 flex items-center gap-1"><Icon name="check-circle" size={12}/> {task.completedBy} ({task.completedAt})</span> : <><span className="text-green-600 font-bold">+{task.reward} Münzen</span>{task.deadline && <span className="text-red-400 font-bold flex items-center gap-1"><Icon name="calendar" size={10}/> {task.deadline}</span>}</>}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => deleteTask(task)} className="w-8 h-8 rounded-full border-2 border-red-100 hover:border-red-500 hover:bg-red-50 flex items-center justify-center transition-colors text-red-300 hover:text-red-500"><Icon name="trash-2" size={14}/></button>
                                        {taskFilter === 'active' && <button onClick={() => toggleTask(task)} className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-colors"><Icon name="check" className="text-transparent hover:text-green-500 w-4 h-4"/></button>}
                                    </div>
                                </div>
                            ))}
                            {getTasks().filter(t => taskFilter === 'active' ? (!t.done || (t.type==='daily' && t.lastDone!==new Date().toISOString().split('T')[0])) : (t.done || (t.type==='daily' && t.lastDone===new Date().toISOString().split('T')[0]))).length === 0 && <div className="text-center py-8 text-gray-400 italic">Keine Aufgaben in dieser Liste.</div>}
                        </div>
                    </div>
                )}

                {tab === 'shop' && !isSpectator && (
                    <div className="p-6 md:max-w-4xl md:mx-auto pb-32">
                        <h3 className="font-bold text-xl text-purple-700 mb-4 flex items-center gap-2"><Icon name="castle"/> Immobilien (Gems)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">{GARDEN_UPGRADES.filter(g => g.id > 0).map(g => { const owned = (roomData.unlockedGardens || []).includes(g.id); return <div key={g.id} className={`p-4 rounded-2xl border-2 flex flex-col items-center ${owned ? 'bg-gray-50 border-gray-200' : 'bg-purple-50 border-purple-200'}`}><div className="text-3xl mb-2">🏞️</div><div className="font-bold">{g.name}</div><button onClick={() => !owned && buy(g.id, true)} disabled={owned || roomData.gems < g.price} className={`mt-2 w-full py-2 rounded-xl text-sm font-bold ${owned ? 'text-gray-400 bg-gray-200' : 'bg-purple-600 text-white'}`}>{owned ? 'Gekauft' : `${g.price} 💎`}</button></div> })}</div>
                        <h3 className="font-bold text-xl text-orange-600 mb-4 flex items-center gap-2"><Icon name="store"/> Markt (Münzen)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Object.values(BASE_ITEMS).map((item: any) => (<div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center"><div className={`text-4xl mb-3 mt-2 ${item.css ? item.css + ' w-12 h-12 rounded flex items-center justify-center' : ''}`}>{item.icon && !item.img && <>{String(item.icon)}</>}<ItemDisplay item={item} className="w-12 h-12" /></div><h3 className="font-bold text-gray-700 text-center text-sm">{item.name}</h3><button onClick={() => buy(item.id, false)} disabled={roomData.coins < item.price} className={`mt-2 w-full py-2 rounded-xl text-sm font-bold transition-all ${roomData.coins >= item.price ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'}`}>{item.price} 💰</button></div>))}</div>
                    </div>
                )}
                
                {tab === 'blackmarket' && !isSpectator && (
                    <BlackMarket roomData={roomData} roomCode={roomCode} user={user} />
                )}

            </main>
            {isTaskModalOpen && (
                <Modal title="Neue Aufgabe" onClose={() => setTaskModalOpen(false)}><div className="space-y-4"><div><label className="text-xs font-bold text-gray-400 uppercase">Titel</label><input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Titel..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 ring-blue-500" /></div><div className="flex gap-4"><div className="flex-1"><label className="text-xs font-bold text-gray-400 uppercase">Belohnung: {newTaskReward}</label><input type="range" min="10" max="100" step="5" value={newTaskReward} onChange={e => setNewTaskReward(parseInt(e.target.value)||10)} className="w-full accent-blue-500 mt-2" /></div></div><div className="flex gap-4"><div className="flex-1"><label className="text-xs font-bold text-gray-400 uppercase">Typ</label><select value={newTaskType} onChange={e => setNewTaskType(e.target.value)} className="w-full border rounded-xl p-2 mt-1"><option value="once">Einmalig</option><option value="daily">Täglich</option></select></div><div className="flex-1"><label className="text-xs font-bold text-gray-400 uppercase">Frist</label><input type="date" value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)} className="w-full border rounded-xl p-2 mt-1" /></div></div><div className="flex gap-2 mt-2"><button onClick={() => setTaskModalOpen(false)} className="flex-1 bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Abbrechen</button><button onClick={createTask} className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl">Erstellen</button></div></div></Modal>
            )}
            <OctoChat user={user} roomData={roomData} />
        </div>
    );
};

const App = () => {
    const [user, setUser] = React.useState<any>(null);
    const [view, setView] = React.useState("menu");
    const [roomCode, setRoomCode] = React.useState("");
    const [isSpectator, setIsSpectator] = React.useState(false);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleAction = async (action: string, code?: string, payload?: any) => {
        if (action === 'community') {
            setView('community');
        } else if (action === 'create') {
            if (!user) return;
            const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            try {
                await setDoc(doc(db, 'rooms', newRoomId), {
                    creatorId: user.uid,
                    roomName: payload || "Unbenannter Garten",
                    coins: 100,
                    gems: 0,
                    unlockedGardens: [0],
                    inventory: {},
                    gardens: { 0: {} },
                    tasks: [],
                    createdAt: new Date().toISOString(),
                    likes: 0,
                    lastStreakDate: null,
                    currentStreak: 0,
                    customDefinitions: {}
                });
                setRoomCode(newRoomId);
                setIsSpectator(false);
                setView('game');
                localStorage.setItem('lastRoom', newRoomId);
            } catch (e) {
                console.error("Create Error", e);
                alert("Fehler beim Erstellen.");
            }
        } else if (action === 'join' || action === 'resume') {
            const targetCode = code || payload;
            if (!targetCode) return;
            const snap = await getDoc(doc(db, 'rooms', targetCode));
            if (snap.exists()) {
                setRoomCode(targetCode);
                setIsSpectator(false);
                setView('game');
                localStorage.setItem('lastRoom', targetCode);
            } else {
                alert("Garten nicht gefunden!");
            }
        }
    };

    const handleVisit = (id: string) => {
        setRoomCode(id);
        setIsSpectator(true);
        setView('game');
    };

    if (loading) return <div className="h-full flex items-center justify-center">Laden...</div>;

    if (!user) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center gap-6 max-w-sm w-full text-center">
                    <div className="text-6xl animate-bounce">🌻</div>
                    <h1 className="text-3xl font-black text-slate-800">DuoBloom</h1>
                    <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all">
                         Google Anmeldung
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'game') return <GameApp user={user} roomCode={roomCode} isSpectator={isSpectator} onBackToMenu={() => setView('menu')} />;
    if (view === 'community') return <CommunityList onVisit={handleVisit} onBack={() => setView('menu')} />;

    return <MainMenu user={user} onAction={handleAction} currentRoom={localStorage.getItem('lastRoom')} />;
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
