import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  MessageSquare, 
  Send, 
  Code, 
  Smile, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  Terminal, 
  Clock, 
  CheckCheck,
  RefreshCw,
  Hash,
  Zap,
  Monitor,
  Globe,
  Play,
  Folder,
  FileCode,
  ChevronRight,
  Minus,
  Maximize2,
  Eye,
  EyeOff,
  Move,
  Bell,
  Smartphone,
  Download,
  X,
  Layers,
  Search,
  BookOpen,
  ExternalLink,
  Cpu,
  Pin,
  PinOff
} from 'lucide-react';

// ==========================================
// 1. KHỞI TẠO FIREBASE VỚI CẤU HÌNH CỦA BẠN
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyB5xj1tKoD2tUCILXBWWUw2S6euhyXwcSM",
  authDomain: "projectchatpvp.firebaseapp.com",
  projectId: "projectchatpvp",
  storageBucket: "projectchatpvp.firebasestorage.app",
  messagingSenderId: "90209101889",
  appId: "1:90209101889:web:e93eea4ce166709c0e7ec0",
  measurementId: "G-4PNSD0TBLQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'vn-desktop-chat-p2p';

// ==========================================
// 2. TIỆN ÍCH ÂM THANH (WEB AUDIO API)
// ==========================================
const playPopSound = (type = 'incoming') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'incoming') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.11);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (e) {
    // Bỏ qua nếu trình duyệt chặn tự động phát âm thanh
  }
};

// ==========================================
// 3. DỮ LIỆU MẪU (TIN NHẮN GIẢ LẬP & CODE)
// ==========================================
const QUICK_EMOJIS = ['😄', '😂', '❤️', '🔥', '👍', '🎉', '🚀', '💻', '☕', '🤔', '👀', '✨'];
const REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥'];

const SIMULATED_FRIEND_MESSAGES = [
  { text: 'Ê Đăng, ông đang code phần WebSocket ở file nào thế? Tôi hỏi nhanh chút!', isCode: false },
  { text: 'Tôi vừa viết xong hàm kết nối này, ông xem thử ổn chưa nhé:', isCode: false },
  { 
    text: `const socket = new WebSocket('wss://chat.dangdev.vn/ws');\nsocket.onmessage = (e) => {\n  console.log('Tin nhắn mới:', JSON.parse(e.data));\n};`, 
    isCode: true 
  },
  { text: 'Nhìn thanh chat nhỏ ở góc màn hình tiện thật, vừa gõ VS Code vừa trả lời không cần Alt + Tab luôn 🔥', isCode: false },
  { text: 'Tối nay 8h nhớ vào phòng #686868 test bản build .exe nhé!', isCode: false }
];

const INITIAL_VSCODE_FILES = {
  'ChatServer.java': `package com.dang.minichat.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class ChatServer implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Kênh truyền tin nhắn thời gian thực cho 2 máy
        config.enableSimpleBroker("/topic/room");
        config.setApplicationDestinationPrefixes("/app");
    }

    public static void main(String[] args) {
        System.out.println("🚀 Server WebSocket đã khởi chạy tại cổng 8080!");
        System.out.println("💡 Bạn có thể vừa sửa code tại đây vừa nhìn thanh chat ở góc phải!");
    }
}`,
  'electron-main.cjs': `const { app, BrowserWindow, screen, globalShortcut } = require('electron');

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: 330,
    height: 440,
    x: width - 350,
    y: height - 470,
    frame: false,
    transparent: true,
    alwaysOnTop: true // Luôn nổi trên mọi ứng dụng khác!
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadURL('http://localhost:5173');
}

app.whenReady().then(createOverlayWindow);`,
  'notes.md': `# Nhật ký phát triển MiniChat Overlay
- [x] Thiết kế giao diện nổi góc màn hình (330x440)
- [x] Bật chế độ Ghost Mode (Tự làm mờ khi chuột rời đi)
- [x] Hỗ trợ phím tắt Alt + C để ẩn/hiện tức thì
- [x] Gửi đoạn code từ VS Code sang thẳng khung chat`
};

const ELECTRON_EXPORT_CODE = `// FILE 1: electron-main.cjs (Đặt ở thư mục gốc của project)
const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 330,
    height: 440,
    x: screenWidth - 350,
    y: screenHeight - 470,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);

  const startUrl = process.env.ELECTRON_START_URL || \`file://\${path.join(__dirname, 'dist/index.html')}\`;
  mainWindow.loadURL(startUrl);

  globalShortcut.register('Alt+C', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

app.whenReady().then(createWindow);`;

// ==========================================
// 4. COMPONENT CHÍNH: MÔ PHỎNG DESKTOP & OVERLAY CHAT
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [roomCode, setRoomCode] = useState('686868');
  const [roomInput, setRoomInput] = useState('686868');

  const [myName, setMyName] = useState('Đăng');
  const [friendName, setFriendName] = useState('Minh (Bạn cùng phòng)');

  const [activeDesktopApp, setActiveDesktopApp] = useState('vscode');
  const [activeFile, setActiveFile] = useState('ChatServer.java');
  const [codeFiles, setCodeFiles] = useState(INITIAL_VSCODE_FILES);
  const [terminalLogs, setTerminalLogs] = useState([
    '[INFO] Khởi tạo môi trường VS Code Simulator thành công.',
    '[TIP] Giữ chuột vào thanh tiêu đề khung chat để kéo thả tới bất kỳ đâu trên màn hình!'
  ]);
  const [browserTab, setBrowserTab] = useState('guide');

  const [widgetMode, setWidgetMode] = useState('expanded');
  const [autoHideEnabled, setAutoHideEnabled] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [isHoveringWidget, setIsHoveringWidget] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [autoPopupActive, setAutoPopupActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const [widgetPos, setWidgetPos] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const hasMovedWhileDraggingRef = useRef(false);
  const desktopContainerRef = useRef(null);

  const [allMessages, setAllMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [friendTyping, setFriendTyping] = useState(false);

  const [showSimulatorDrawer, setShowSimulatorDrawer] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [clockText, setClockText] = useState('');

  const messagesEndRef = useRef(null);
  const prevMsgCountRef = useRef(0);
  const simIndexRef = useRef(0);
  const hideTimerRef = useRef(null);
  const popupTimerRef = useRef(null);
  const broadcastRef = useRef(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockText(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const initDefaultPosition = () => {
      if (!desktopContainerRef.current) return;
      const rect = desktopContainerRef.current.getBoundingClientRect();
      setWidgetPos((prev) => {
        if (prev.x !== null && prev.y !== null) return prev;
        return {
          x: Math.max(16, rect.width - 330 - 20),
          y: Math.max(16, rect.height - 440 - 58)
        };
      });
    };
    initDefaultPosition();
    window.addEventListener('resize', initDefaultPosition);
    return () => window.removeEventListener('resize', initDefaultPosition);
  }, []);

  useEffect(() => {
    if (!autoHideEnabled || isPinned) return;

    if (isHoveringWidget || isDragging || isInputFocused || autoPopupActive) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (isHoveringWidget && widgetMode !== 'expanded') {
        setWidgetMode('expanded');
      }
      return;
    }

    hideTimerRef.current = setTimeout(() => {
      setWidgetMode('bar');
      setShowEmojiPicker(false);
    }, 650);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [
    autoHideEnabled,
    isPinned,
    isHoveringWidget,
    isDragging,
    isInputFocused,
    autoPopupActive,
    widgetMode
  ]);

  const triggerIncomingPopup = () => {
    setWidgetMode('expanded');
    setAutoPopupActive(true);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => {
      setAutoPopupActive(false);
    }, 4500);
  };

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('minichat_p2p_sync');
    broadcastRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_MESSAGE' && event.data.roomCode === roomCode) {
        triggerIncomingPopup();
      }
    };
    return () => channel.close();
  }, [roomCode]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setWidgetMode((prev) => (prev === 'expanded' ? 'bar' : 'expanded'));
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error('Lỗi đăng nhập Firebase:', err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chat_messages');

    const unsubMessages = onSnapshot(
      messagesRef,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.roomCode === roomCode) {
            list.push({ id: docSnap.id, ...data });
          }
        });
        list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setAllMessages(list);

        if (list.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
          const newest = list[list.length - 1];
          const myId = `${user.uid}_A`;
          if (newest && newest.senderId !== myId) {
            if (soundEnabled) playPopSound('incoming');
            triggerIncomingPopup();
            if (!isHoveringWidget) {
              setUnreadCount((c) => c + 1);
            }
          }
        }
        prevMsgCountRef.current = list.length;
      },
      (err) => console.error('Lỗi lắng nghe tin nhắn:', err)
    );

    return () => unsubMessages();
  }, [user, roomCode, soundEnabled, isHoveringWidget]);

  useEffect(() => {
    if (widgetMode === 'expanded') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (isHoveringWidget) {
        setUnreadCount(0);
      }
    }
  }, [allMessages, widgetMode, friendTyping, isHoveringWidget]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !desktopContainerRef.current) return;
      hasMovedWhileDraggingRef.current = true;
      const rect = desktopContainerRef.current.getBoundingClientRect();
      const boxWidth = widgetMode === 'expanded' ? 330 : 260;
      const boxHeight = widgetMode === 'expanded' ? 440 : 52;

      const newX = Math.max(8, Math.min(e.clientX - rect.left - dragOffsetRef.current.x, rect.width - boxWidth - 8));
      const newY = Math.max(8, Math.min(e.clientY - rect.top - dragOffsetRef.current.y, rect.height - boxHeight - 48));
      setWidgetPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, widgetMode]);

  const startDrag = (e) => {
    if (e.button !== 0) return;
    if (!desktopContainerRef.current) return;
    const widgetEl = e.currentTarget.closest('.draggable-chat-widget');
    if (!widgetEl) return;
    const widgetRect = widgetEl.getBoundingClientRect();
    hasMovedWhileDraggingRef.current = false;
    dragOffsetRef.current = {
      x: e.clientX - widgetRect.left,
      y: e.clientY - widgetRect.top
    };
    setIsDragging(true);
  };

  const getSafeExpandedStyle = () => {
    if (widgetPos.x === null || widgetPos.y === null || !desktopContainerRef.current) {
      return { right: '20px', bottom: '56px' };
    }
    const rect = desktopContainerRef.current.getBoundingClientRect();
    const safeX = Math.max(8, Math.min(widgetPos.x, rect.width - 338));
    const safeY = Math.max(8, Math.min(widgetPos.y, rect.height - 488));
    return { left: `${safeX}px`, top: `${safeY}px` };
  };

  const sendMessageToRoom = async ({ text, isCode, senderRole = 'me' }) => {
    if (!user || !text.trim()) return;
    const isMe = senderRole === 'me';
    const senderId = isMe ? `${user.uid}_A` : `${user.uid}_B`;
    const senderName = isMe ? myName : friendName;

    try {
      if (isMe && soundEnabled) playPopSound('outgoing');
      const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chat_messages');
      await addDoc(messagesRef, {
        text,
        isCode: Boolean(isCode),
        senderId,
        senderName,
        roomCode,
        createdAt: Date.now(),
        seenBy: [senderId],
        reactions: {}
      });
      if (!isMe && broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'NEW_MESSAGE', roomCode });
      }
    } catch (err) {
      console.error('Lỗi gửi tin nhắn:', err);
    }
  };

  const handleMySubmit = (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    sendMessageToRoom({ text: inputText, isCode: isCodeMode, senderRole: 'me' });
    setInputText('');
    setIsCodeMode(false);
    setShowEmojiPicker(false);
  };

  const triggerSimulatedFriendMessage = (customMsg = null) => {
    if (friendTyping) return;
    setFriendTyping(true);
    triggerIncomingPopup();

    setTimeout(async () => {
      setFriendTyping(false);
      if (customMsg) {
        await sendMessageToRoom({ text: customMsg, isCode: false, senderRole: 'friend' });
      } else {
        const sample = SIMULATED_FRIEND_MESSAGES[simIndexRef.current % SIMULATED_FRIEND_MESSAGES.length];
        simIndexRef.current += 1;
        await sendMessageToRoom({ text: sample.text, isCode: sample.isCode, senderRole: 'friend' });
      }
    }, 900);
  };

  const handleToggleReaction = async (messageId, emoji) => {
    if (!user) return;
    const myId = `${user.uid}_A`;
    try {
      const target = allMessages.find((m) => m.id === messageId);
      if (!target) return;
      const reactions = { ...(target.reactions || {}) };
      const list = reactions[emoji] || [];
      if (list.includes(myId)) {
        reactions[emoji] = list.filter((id) => id !== myId);
      } else {
        reactions[emoji] = [...list, myId];
      }
      const msgRef = doc(db, 'artifacts', appId, 'public', 'data', 'chat_messages', messageId);
      await updateDoc(msgRef, { reactions });
    } catch (err) {
      console.error('Lỗi thả cảm xúc:', err);
    }
  };

  const handleClearMessages = async () => {
    if (!user) return;
    try {
      for (const msg of allMessages) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chat_messages', msg.id));
      }
    } catch (err) {
      console.error('Lỗi xóa lịch sử:', err);
    }
  };

  const runSimulatedCode = () => {
    const time = new Date().toLocaleTimeString('vi-VN');
    setTerminalLogs((prev) => [
      ...prev,
      `[${time}] $ javac ${activeFile} && java ChatServer`,
      `[${time}] 🚀 Server WebSocket đã khởi chạy tại cổng 8080! (Phòng #${roomCode} đang hoạt động)`
    ]);
  };

  const shareCurrentCodeToChat = () => {
    const snippet = codeFiles[activeFile] || '';
    sendMessageToRoom({
      text: `// File: ${activeFile}\n` + snippet.slice(0, 320) + (snippet.length > 320 ? '\n// ...' : ''),
      isCode: true,
      senderRole: 'me'
    });
    triggerIncomingPopup();
  };

  const handleCopy = (id, content) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const myUid = user ? `${user.uid}_A` : 'local_A';
  const lastMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;

  return (
    <div
      ref={desktopContainerRef}
      className="relative h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans"
    >
              {/* KHUNG CHAT NỔI (330x440px) */}
        {widgetMode === 'expanded' && (
          <div
            onMouseEnter={() => {
              setIsHoveringWidget(true);
              setUnreadCount(0);
            }}
            onMouseLeave={() => setIsHoveringWidget(false)}
            style={getSafeExpandedStyle()}
            className={`draggable-chat-widget absolute z-40 w-[330px] h-[440px] bg-[#0f172a]/95 backdrop-blur-xl border-2 border-indigo-500/60 rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden transition-opacity duration-200 ${
              ghostMode && !isHoveringWidget && !isInputFocused ? 'opacity-40 hover:opacity-100' : 'opacity-100'
            }`}
          >
            <div
              onMouseDown={startDrag}
              className="px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950/95 to-slate-900 border-b border-slate-700/80 flex items-center justify-between cursor-move select-none shrink-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
                    M
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full"></span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{friendName.split(' ')[0]}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      #{roomCode}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 truncate">
                    <Move className="w-2.5 h-2.5 text-indigo-300 shrink-0" />
                    <span>{autoPopupActive ? 'Tin nhắn mới' : 'Kéo thả tự do'}</span>
                  </div>
                </div>
              </div>

              <div onMouseDown={(e) => e.stopPropagation()} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsPinned((p) => !p)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isPinned || !autoHideEnabled
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSoundEnabled((s) => !s)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                </button>
                <button
                  type="button"
                  onClick={handleClearMessages}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHoveringWidget(false);
                    setAutoPopupActive(false);
                    setWidgetMode('bar');
                  }}
                  className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-indigo-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                <span>Mã phòng:</span>
                <input
                  type="text"
                  value={roomInput}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => {
                    setIsInputFocused(false);
                    if (roomInput.trim()) setRoomCode(roomInput.trim());
                  }}
                  onChange={(e) => setRoomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomInput.trim()) setRoomCode(roomInput.trim());
                  }}
                  className="w-16 bg-slate-950 border border-slate-700 rounded-md px-1.5 py-0.5 text-indigo-300 font-mono font-bold text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Tên bạn:</span>
                <input
                  type="text"
                  value={myName}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onChange={(e) => setMyName(e.target.value)}
                  className="w-16 bg-slate-950 border border-slate-700 rounded-md px-1.5 py-0.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* DANH SÁCH TIN NHẮN ĐÃ CHẶN SỰ KIỆN CUỘN TRANG */}
            <div 
              className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar"
              onWheel={(e) => e.stopPropagation()}
            >
              {allMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                  <MessageSquare className="w-8 h-8 text-indigo-400 mb-2 opacity-80" />
                  <p className="text-xs font-semibold text-slate-200">Phòng chat trống</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Nhập tin nhắn bên dưới hoặc bấm nút "Cho Minh nhắn tin tới" phía trên để test!
                  </p>
                </div>
              ) : (
                allMessages.map((msg) => {
                  const isMe = msg.senderId === myUid;
                  const reactions = msg.reactions || {};

                  return (
                    <div key={msg.id} className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-medium text-slate-400">{msg.senderName}</span>
                      </div>

                      <div className={`flex items-center gap-1.5 max-w-[90%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div
                          className={`rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-md ${
                            msg.isCode
                              ? 'bg-slate-950 border border-slate-700 text-emerald-300 font-mono w-full overflow-x-auto'
                              : isMe
                              ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-tr-xs'
                              : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-xs'
                          }`}
                        >
                          {msg.isCode ? (
                            <div>
                              <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 text-[10px] text-slate-400 font-sans">
                                <span className="text-indigo-400 font-semibold">Code Snippet</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(msg.id, msg.text)}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                >
                                  {copiedId === msg.id ? 'Đã chép' : 'Copy'}
                                </button>
                              </div>
                              <pre className="text-[11px] leading-4 whitespace-pre overflow-x-auto">{msg.text}</pre>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          )}
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5 shadow">
                          {REACTION_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => handleToggleReaction(msg.id, em)}
                              className="hover:scale-125 transition-transform px-0.5 text-xs cursor-pointer"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>

                      {Object.keys(reactions).length > 0 && (
                        <div className="flex gap-1 mt-1 px-1">
                          {Object.entries(reactions).map(([em, users]) =>
                            users && users.length > 0 ? (
                              <span key={em} className="text-[10px] bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5">
                                {em} {users.length > 1 ? users.length : ''}
                              </span>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {friendTyping && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 w-fit px-3 py-1 rounded-full animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Minh đang gõ tin nhắn...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleMySubmit} className="p-2.5 bg-slate-900 border-t border-slate-800 relative shrink-0">
              {showEmojiPicker && (
                <div className="absolute bottom-full left-2 mb-1.5 p-1.5 bg-slate-800 border border-slate-700 rounded-xl shadow-xl flex flex-wrap gap-1 w-56 z-30">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        setInputText((prev) => prev + em);
                        setShowEmojiPicker(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700 text-base cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((s) => !s)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCodeMode((s) => !s)}
                  className={`p-2 rounded-xl border cursor-pointer ${
                    isCodeMode
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Code className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isCodeMode ? 'Dán đoạn code...' : 'Nhập tin nhắn...'}
                  className="flex-1 min-w-0 bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-indigo-500"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium flex items-center cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {widgetMode !== 'expanded' && (
          <div
            onMouseDown={startDrag}
            onMouseEnter={() => {
              if (!isDragging && autoHideEnabled && !isPinned) {
                setIsHoveringWidget(true);
                setWidgetMode('expanded');
                setUnreadCount(0);
              }
            }}
            onClick={() => {
              if (!hasMovedWhileDraggingRef.current) {
                setIsHoveringWidget(true);
                setWidgetMode('expanded');
                setUnreadCount(0);
              }
            }}
            style={
              widgetPos.x !== null && widgetPos.y !== null
                ? { left: `${widgetPos.x}px`, top: `${widgetPos.y}px` }
                : { right: '20px', bottom: '56px' }
            }
            className="draggable-chat-widget absolute z-40 group bg-slate-900/95 hover:bg-indigo-950/95 backdrop-blur-xl border-2 border-indigo-500/70 rounded-2xl px-3.5 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.75)] flex items-center gap-2.5 cursor-move select-none transition-transform duration-150 hover:scale-105"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>

            <div className="flex items-center gap-2 max-w-[210px]">
              <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-100 truncate">
                {lastMessage ? `${lastMessage.senderName.split(' ')[0]}: ${lastMessage.text}` : 'Rê chuột vào để mở Chat'}
              </span>
            </div>

            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold animate-bounce">
                +{unreadCount}
              </span>
            )}
          </div>
        )}
    </div>
  );
}
