import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, setDoc 
} from 'firebase/firestore';

// --- KHỞI TẠO FIREBASE REALTIME ---
let app = null;
let auth = null;
let db = null;
try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' && __firebase_config
    ? JSON.parse(__firebase_config)
    : null;
  if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.warn('Firebase init fallback:', e);
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const CHANNELS = [
  { id: 'TEAM', label: 'Đội', color: '#38bdf8' },
  { id: 'ALL', label: 'Tất cả', color: '#f59e0b' },
  { id: 'BROADCAST', label: 'Phát sóng', color: '#c8aa6e' },
];

const QUICK_ROOMS = ['SANH-CHUNG', 'TEAM-1', 'TEAM-2', 'SOLO-PVP'];
const EMOJIS = ['😀', '😂', '😎', '😭', '😡', '👍', '❤️', '🔥', '🎉', '👀', '🛡️', '⚔️'];

export default function App() {
  const [user, setUser] = useState(null);
  const [nickname, setNickname] = useState('Vệ Quân ' + Math.floor(10 + Math.random() * 89));
  const [roomId, setRoomId] = useState('SANH-CHUNG');
  const [channelIdx, setChannelIdx] = useState(0);

  const [cloudMessages, setCloudMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [localSystemMsgs, setLocalSystemMsgs] = useState([
    {
      id: 'init-broadcast',
      isSystem: true,
      channel: 'BROADCAST',
      text: 'Chào mừng! Bấm vào thanh tiêu đề hoặc nút ⚙️ bên trái để đổi tên và phòng chat.',
      timeLabel: '00:26',
      timestamp: 1
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChannelMenu, setShowChannelMenu] = useState(false);

  // Chế độ hiển thị: 'FULL' (đầy đủ), 'BAR' (ẩn khung lịch sử, chỉ hiện thanh nhập), 'ICON' (chỉ hiện nút mặt cười)
  const [viewMode, setViewMode] = useState('FULL');
  const [unreadCount, setUnreadCount] = useState(0);

  // State chỉnh sửa trực tiếp trong bảng tích hợp
  const [tempName, setTempName] = useState('');
  const [tempRoom, setTempRoom] = useState('');
  const [editingInlineName, setEditingInlineName] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState(false);

  // Vị trí và kích thước của riêng khung chat
  const [pos, setPos] = useState({ x: 40, y: 120 });
  const [boxSize, setBoxSize] = useState({ width: 460, height: 170 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, offsetX: 0, offsetY: 0, moved: false });
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 460, startH: 170 });
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  // Đồng bộ giá trị form khi mở bảng cài đặt
  useEffect(() => {
    setTempName(nickname);
    setTempRoom(roomId);
  }, [nickname, roomId, showSettings]);

  // 1. Xác thực Firebase
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // 2. Lắng nghe tin nhắn & trạng thái người dùng trực tuyến theo phòng
  useEffect(() => {
    if (!user || !db || !roomId) return;
    const cleanRoom = roomId.trim().toUpperCase();
    const msgColRef = collection(db, 'artifacts', appId, 'public', 'data', `tft_hud_chat_${cleanRoom}`);
    const presenceColRef = collection(db, 'artifacts', appId, 'public', 'data', `tft_hud_presence_${cleanRoom}`);

    const unsubMsgs = onSnapshot(
      msgColRef,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setCloudMessages(list.slice(-80));
      },
      (err) => console.error('Sync error:', err)
    );

    const updatePresence = async () => {
      try {
        const userDoc = doc(db, 'artifacts', appId, 'public', 'data', `tft_hud_presence_${cleanRoom}`, user.uid);
        await setDoc(userDoc, {
          uid: user.uid,
          name: nickname,
          lastSeen: Date.now()
        }, { merge: true });
      } catch (e) {
        console.warn('Presence update warning:', e);
      }
    };

    updatePresence();
    const heartbeat = setInterval(updatePresence, 20000);

    const unsubPresence = onSnapshot(
      presenceColRef,
      (snap) => {
        const now = Date.now();
        const active = [];
        snap.forEach((d) => {
          const data = d.data();
          if (now - (data.lastSeen || 0) < 60000) {
            active.push(data);
          }
        });
        setOnlineUsers(active);
      },
      (err) => console.warn('Presence error:', err)
    );

    return () => {
      unsubMsgs();
      unsubPresence();
      clearInterval(heartbeat);
    };
  }, [user, roomId, nickname]);

  const allMessages = [...localSystemMsgs, ...cloudMessages].sort(
    (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
  );

  // Đếm tin nhắn chưa đọc khi đang thu nhỏ và tự cuộn xuống cuối
  useEffect(() => {
    if (allMessages.length > prevMsgCountRef.current) {
      if (viewMode !== 'FULL') {
        setUnreadCount((c) => c + (allMessages.length - prevMsgCountRef.current));
      } else {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMsgCountRef.current = allMessages.length;
  }, [allMessages.length, viewMode]);

  useEffect(() => {
    if (viewMode === 'FULL') {
      setUnreadCount(0);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [viewMode]);

  // 3. Xử lý kéo di chuyển và kéo giãn khung chat
  useEffect(() => {
    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      if (dragging) {
        if (
          Math.abs(clientX - dragRef.current.startX) > 3 ||
          Math.abs(clientY - dragRef.current.startY) > 3
        ) {
          dragRef.current.moved = true;
        }
        const nextX = Math.max(8, Math.min(window.innerWidth - 80, clientX - dragRef.current.offsetX));
        const nextY = Math.max(8, Math.min(window.innerHeight - 48, clientY - dragRef.current.offsetY));
        setPos({ x: nextX, y: nextY });
      }

      if (resizing) {
        const dw = clientX - resizeRef.current.startX;
        const dh = clientY - resizeRef.current.startY;
        setBoxSize({
          width: Math.max(310, Math.min(window.innerWidth - pos.x - 48, resizeRef.current.startW + dw)),
          height: Math.max(110, Math.min(window.innerHeight - pos.y - 60, resizeRef.current.startH + dh)),
        });
      }
    };

    const handleUp = () => {
      setDragging(false);
      setResizing(false);
    };

    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, resizing, pos.x, pos.y]);

  const startDrag = (e) => {
    if (e.target.closest('input') || e.target.closest('[data-nodrag="true"]')) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      offsetX: clientX - pos.x,
      offsetY: clientY - pos.y,
      moved: false,
    };
    setDragging(true);
  };

  const startResize = (e) => {
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    resizeRef.current = {
      startX: clientX,
      startY: clientY,
      startW: boxSize.width,
      startH: boxSize.height,
    };
    setResizing(true);
  };

  const formatTime = (ts, fallback) => {
    if (fallback) return fallback;
    if (!ts) return '00:00';
    const d = new Date(ts);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const addSystemMessage = (text) => {
    setLocalSystemMsgs((prev) => [
      ...prev,
      {
        id: 'sys-' + Date.now() + '-' + Math.random(),
        isSystem: true,
        channel: 'BROADCAST',
        text,
        timestamp: Date.now(),
      },
    ]);
  };

  const handleSaveProfileAndRoom = (e) => {
    if (e) e.preventDefault();
    const cleanName = tempName.trim().slice(0, 22);
    const cleanRoom = tempRoom.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, '');

    if (cleanName && cleanName !== nickname) {
      setNickname(cleanName);
      addSystemMessage(`Đã đổi tên hiển thị thành: ${cleanName}`);
    }
    if (cleanRoom && cleanRoom !== roomId) {
      setRoomId(cleanRoom);
      addSystemMessage(`Đã chuyển sang phòng chat: ${cleanRoom}`);
    }
    setEditingInlineName(false);
    setShowSettings(false);
  };

  const handleCopyRoom = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomId);
      setCopiedRoom(true);
      setTimeout(() => setCopiedRoom(false), 1800);
    }
  };

  const handleClearChat = () => {
    setLocalSystemMsgs([
      {
        id: 'sys-clear-' + Date.now(),
        isSystem: true,
        channel: 'BROADCAST',
        text: 'Đã làm sạch lịch sử khung chat.',
        timestamp: Date.now(),
      }
    ]);
    setCloudMessages([]);
  };

  const toggleViewMode = () => {
    setViewMode((prev) => {
      if (prev === 'FULL') return 'BAR';
      if (prev === 'BAR') return 'ICON';
      return 'FULL';
    });
  };

  // 4. Gửi tin nhắn trực tiếp
  const handleSend = async (e, quickText = null) => {
    if (e) e.preventDefault();
    const text = (quickText !== null ? quickText : inputText).trim();
    if (!text) return;

    if (quickText === null) setInputText('');
    setShowEmoji(false);

    const activeChan = CHANNELS[channelIdx];

    if (user && db) {
      try {
        const cleanRoom = roomId.trim().toUpperCase();
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', `tft_hud_chat_${cleanRoom}`);
        await addDoc(colRef, {
          text,
          channel: activeChan.id,
          senderId: user.uid,
          senderName: nickname,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('Send error:', err);
      }
    } else {
      setLocalSystemMsgs((prev) => [
        ...prev,
        {
          id: 'local-' + Date.now(),
          channel: activeChan.id,
          senderName: nickname,
          text,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const currentChan = CHANNELS[channelIdx];

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      className="fixed z-50 flex items-start gap-[5px] select-none font-sans"
    >
      {/* CỘT TRÁI: NÚT MẶT CƯỜI + CÁC NÚT CHỨC NĂNG TÍCH HỢP VIỀN VÀNG ĐỒNG */}
      <div className="relative flex flex-col items-center gap-[4px]">
        {/* 1. Nút Mặt Cười (Kéo di chuyển / Bấm mở Emoji / Mở lại khi đang thu nhỏ) */}
        <button
          type="button"
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          onClick={() => {
            if (!dragRef.current.moved) {
              if (viewMode === 'ICON') {
                setViewMode('FULL');
              } else {
                setShowEmoji((prev) => !prev);
                setShowSettings(false);
              }
            }
          }}
          title={
            viewMode === 'ICON'
              ? 'Nhấn để mở rộng lại khung chat • Kéo để di chuyển'
              : 'Kéo để di chuyển khung chat • Nhấn để chọn biểu cảm'
          }
          className="relative w-[34px] h-[34px] bg-[#0a121c]/90 hover:bg-[#122032] border border-[#785a28] flex items-center justify-center cursor-move shadow-[inset_0_0_4px_rgba(200,170,110,0.25)] transition"
        >
          <svg viewBox="0 0 24 24" className="w-[20px] h-[20px] fill-[#c8aa6e]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 6c.83 0 1.5.67 1.5 1.5S16.33 11 15.5 11 14 10.33 14 9.5 14.67 8 15.5 8zm-7 0c.83 0 1.5.67 1.5 1.5S9.33 11 8.5 11 7 10.33 7 9.5 7.67 8 8.5 8zm3.5 9.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z" />
          </svg>
          {unreadCount > 0 && viewMode !== 'FULL' && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#e11d48] border border-[#c8aa6e] text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Các nút công cụ nhanh bên dưới nút mặt cười (ẩn khi ở chế độ chỉ hiện Icon) */}
        {viewMode !== 'ICON' && (
          <>
            {/* 2. Nút Cài Đặt Tên & Phòng Chat */}
            <button
              type="button"
              data-nodrag="true"
              onClick={() => {
                setShowSettings((prev) => !prev);
                setShowEmoji(false);
              }}
              title="Đổi tên hiển thị, chuyển phòng & xem bạn bè trong phòng"
              className={`w-[34px] h-[28px] border border-[#785a28] flex items-center justify-center transition ${
                showSettings ? 'bg-[#785a28]/40 text-[#f0e6d2]' : 'bg-[#0a121c]/85 hover:bg-[#122032] text-[#c8aa6e]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] fill-current">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>

            {/* 3. Nút Thu Gọn / Phóng To Khung Lịch Sử */}
            <button
              type="button"
              data-nodrag="true"
              onClick={toggleViewMode}
              title={
                viewMode === 'FULL'
                  ? 'Thu gọn khung lịch sử (chỉ giữ thanh nhập)'
                  : 'Thu nhỏ thành bong bóng mặt cười'
              }
              className="w-[34px] h-[28px] bg-[#0a121c]/85 hover:bg-[#122032] border border-[#785a28] flex items-center justify-center text-[#c8aa6e] transition"
            >
              {viewMode === 'FULL' ? (
                <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] fill-current">
                  <path d="M19 13H5v-2h14v2z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] fill-current">
                  <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                </svg>
              )}
            </button>

            {/* 4. Nút Xóa Nhanh Lịch Sử Chat */}
            {viewMode === 'FULL' && (
              <button
                type="button"
                data-nodrag="true"
                onClick={handleClearChat}
                title="Xóa sạch lịch sử tin nhắn"
                className="w-[34px] h-[28px] bg-[#0a121c]/85 hover:bg-[#2a1215] border border-[#785a28] flex items-center justify-center text-[#c8aa6e] hover:text-[#f87171] transition"
              >
                <svg viewBox="0 0 24 24" className="w-[14px] h-[14px] fill-current">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </button>
            )}
          </>
        )}

        {/* Popup Emoji nhỏ gọn */}
        {showEmoji && viewMode !== 'ICON' && (
          <div
            data-nodrag="true"
            className="absolute left-[39px] top-0 w-[184px] bg-[#080e16]/95 border border-[#785a28] p-1.5 grid grid-cols-4 gap-1 shadow-2xl z-50"
          >
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => handleSend(null, em)}
                className="p-1 text-sm hover:bg-[#785a28]/30 rounded text-center transition"
              >
                {em}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CỘT PHẢI: KHUNG CHAT CHÍNH (Ẩn khi ở chế độ ICON) */}
      {viewMode !== 'ICON' && (
        <div style={{ width: `${boxSize.width}px` }} className="relative flex flex-col gap-[5px]">
          {/* BẢNG CÀI ĐẶT NHANH NỔI NGAY TRONG KHUNG CHAT (Đổi Tên, Đổi Phòng, Xem Bạn Bè) */}
          {showSettings && (
            <div
              data-nodrag="true"
              className="w-full bg-[#080e16]/95 border border-[#c8aa6e] p-2.5 text-[12px] text-[#f0e6d2] shadow-2xl z-40 space-y-2.5"
            >
              <div className="flex items-center justify-between border-b border-[#785a28]/60 pb-1.5">
                <span className="font-bold text-[#c8aa6e] uppercase tracking-wider text-[11px]">
                  Thiết Lập Phòng & Nhân Vật
                </span>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="text-[#948875] hover:text-[#f0e6d2] px-1 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProfileAndRoom} className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[#c8aa6e] mb-0.5">Biệt danh của bạn:</label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Nhập tên..."
                    className="w-full bg-[#05090e] border border-[#785a28] px-2 py-1 text-[12px] text-[#f0e6d2] focus:outline-none focus:border-[#c8aa6e]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#c8aa6e] mb-0.5">Mã phòng (Gửi bạn bè):</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={tempRoom}
                      onChange={(e) => setTempRoom(e.target.value.toUpperCase())}
                      placeholder="VD: TEAM-1"
                      className="w-full bg-[#05090e] border border-[#785a28] px-2 py-1 text-[12px] text-[#38bdf8] font-bold focus:outline-none focus:border-[#c8aa6e]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyRoom}
                      title="Copy mã phòng"
                      className="px-2 bg-[#122032] border border-[#785a28] text-[11px] text-[#c8aa6e] hover:text-white shrink-0"
                    >
                      {copiedRoom ? 'Đã chép' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Chọn phòng nhanh 1 chạm */}
                <div className="col-span-2 flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[11px] text-[#948875] mr-1">Phòng nhanh:</span>
                    {QUICK_ROOMS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setTempRoom(r);
                          setRoomId(r);
                          addSystemMessage(`Đã vào phòng: ${r}`);
                        }}
                        className={`px-1.5 py-0.5 text-[10px] border transition ${
                          roomId === r
                            ? 'bg-[#785a28]/60 border-[#c8aa6e] text-white font-bold'
                            : 'bg-[#05090e] border-[#785a28]/60 text-[#c8aa6e] hover:border-[#c8aa6e]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#785a28] hover:bg-[#936f32] border border-[#c8aa6e] text-[#f0e6d2] font-bold text-[11px] transition"
                  >
                    Lưu Thiết Lập
                  </button>
                </div>
              </form>

              {/* Danh sách người đang trong phòng */}
              <div className="border-t border-[#785a28]/50 pt-1.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[#948875]">Đang trong phòng ({ Math.max(1, onlineUsers.length) }):</span>
                  {onlineUsers.length === 0 ? (
                    <span className="text-[#f0e6d2] font-semibold">{nickname} (Bạn)</span>
                  ) : (
                    onlineUsers.map((u) => (
                      <span
                        key={u.uid}
                        className="px-1.5 py-0.2 bg-[#122032] border border-[#785a28]/60 text-[#f0e6d2]"
                      >
                        {u.name} {user && u.uid === user.uid ? '(Bạn)' : ''}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* KHUNG HIỂN THỊ TIN NHẮN BÁN TRONG SUỐT */}
          {viewMode === 'FULL' && (
            <div
              onMouseDown={startDrag}
              onTouchStart={startDrag}
              style={{ height: `${boxSize.height}px` }}
              className="relative w-full bg-[#080e16]/75 border border-[#785a28]/90 flex flex-col cursor-move"
            >
              {/* THANH MINI-BAR TÍCH HỢP NGAY ĐẦU KHUNG LỊCH SỬ (Bấm đổi tên/phòng trực tiếp) */}
              <div className="h-[24px] px-2 bg-[#05090e]/70 border-b border-[#785a28]/50 flex items-center justify-between text-[11px] shrink-0">
                <div className="flex items-center gap-2">
                  {/* Bấm vào Phòng để copy hoặc mở bảng đổi phòng */}
                  <button
                    type="button"
                    data-nodrag="true"
                    onClick={() => setShowSettings((prev) => !prev)}
                    title="Nhấn để đổi mã phòng"
                    className="flex items-center gap-1 text-[#c8aa6e] hover:text-[#f0e6d2] font-semibold"
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Phòng:</span>
                    <span className="text-[#38bdf8] font-bold">{roomId}</span>
                  </button>

                  <button
                    type="button"
                    data-nodrag="true"
                    onClick={handleCopyRoom}
                    title="Copy mã phòng gửi cho bạn bè"
                    className="px-1 bg-[#122032] border border-[#785a28]/70 text-[10px] text-[#c8aa6e] hover:text-white"
                  >
                    {copiedRoom ? '✓ Đã chép' : 'Copy mã'}
                  </button>
                </div>

                {/* Chỉnh nhanh biệt danh ngay trên thanh mini-bar */}
                <div className="flex items-center gap-2" data-nodrag="true">
                  {editingInlineName ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (tempName.trim()) setNickname(tempName.trim().slice(0, 22));
                        setEditingInlineName(false);
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={() => {
                          if (tempName.trim()) setNickname(tempName.trim().slice(0, 22));
                          setEditingInlineName(false);
                        }}
                        className="w-[105px] bg-[#05090e] border border-[#c8aa6e] px-1 text-[11px] text-[#f0e6d2] focus:outline-none"
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTempName(nickname);
                        setEditingInlineName(true);
                      }}
                      title="Nhấn để sửa nhanh tên của bạn"
                      className="text-[#948875] hover:text-[#f0e6d2] flex items-center gap-1"
                    >
                      <span>Tên:</span>
                      <span className="text-[#f0e6d2] font-semibold underline decoration-[#785a28]">
                        {nickname}
                      </span>
                      <span className="text-[#c8aa6e] text-[10px]">✎</span>
                    </button>
                  )}
                </div>
              </div>

              {/* DANH SÁCH TIN NHẮN */}
              <div className="flex-1 px-2.5 py-1.5 overflow-y-auto space-y-1 text-[13px] leading-[1.35] select-text cursor-auto">
                {allMessages.map((msg) => {
                  const timeStr = formatTime(msg.timestamp, msg.timeLabel);

                  if (msg.isSystem || msg.channel === 'BROADCAST') {
                    return (
                      <div
                        key={msg.id}
                        className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)] break-words"
                      >
                        <span className="font-bold text-[#f0e6d2] mr-1.5">{timeStr}</span>
                        <span className="text-[#c8aa6e] font-semibold">
                          [Phát sóng] {msg.senderName && !msg.isSystem ? `${msg.senderName}: ` : ''}
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  const isAll = msg.channel === 'ALL';
                  const tagColor = isAll ? 'text-[#f59e0b]' : 'text-[#38bdf8]';
                  const tagName = isAll ? '[Tất cả]' : '[Đội]';

                  return (
                    <div
                      key={msg.id}
                      className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)] break-words"
                    >
                      <span className="font-bold text-[#f0e6d2] mr-1.5">{timeStr}</span>
                      <span className={`${tagColor} font-semibold mr-1`}>{tagName}</span>
                      <span className={`${tagColor} font-semibold mr-1.5`}>{msg.senderName}:</span>
                      <span className="text-[#f0e6d2]">{msg.text}</span>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Góc kéo thay đổi kích thước khung chat */}
              <div
                onMouseDown={startResize}
                onTouchStart={startResize}
                data-nodrag="true"
                title="Kéo để thay đổi kích thước rộng/cao của khung chat"
                className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize flex items-end justify-end p-[1px]"
              >
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-[#c8aa6e]/70">
                  <path d="M10 0v10H0L10 0z" />
                </svg>
              </div>
            </div>
          )}

          {/* THANH NHẬP TIN NHẮN Ở DƯỚI (Đội 💬 | Nhập tin nhắn của bạn... | ➤) */}
          <form
            onSubmit={(e) => handleSend(e)}
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            className="relative h-[34px] w-full bg-[#080e16]/85 border border-[#785a28] flex items-center px-2.5 gap-2"
          >
            {/* Menu chọn kênh nổi lên khi bấm vào Đội 💬 */}
            {showChannelMenu && (
              <div
                data-nodrag="true"
                className="absolute left-0 bottom-[36px] bg-[#080e16]/95 border border-[#785a28] py-1 shadow-xl z-50 min-w-[115px]"
              >
                {CHANNELS.map((ch, idx) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setChannelIdx(idx);
                      setShowChannelMenu(false);
                      inputRef.current?.focus();
                    }}
                    className={`w-full px-2.5 py-1 text-left text-[12px] font-bold flex items-center justify-between hover:bg-[#785a28]/30 ${
                      channelIdx === idx ? 'bg-[#785a28]/20' : ''
                    }`}
                    style={{ color: ch.color }}
                  >
                    <span>{ch.label}</span>
                    {channelIdx === idx && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Nút kênh chat: Đội 💬 */}
            <button
              type="button"
              data-nodrag="true"
              onClick={() => setShowChannelMenu((prev) => !prev)}
              title="Nhấn để chọn kênh chat (Đội / Tất cả / Phát sóng)"
              className="flex items-center gap-1.5 pr-1.5 shrink-0 hover:brightness-125"
            >
              <span
                style={{ color: currentChan.color }}
                className="font-bold text-[13px] tracking-tight"
              >
                {currentChan.label}
              </span>
              <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] fill-[#d8d0c5]">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </button>

            {/* Ô nhập văn bản */}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => setShowChannelMenu(false)}
              placeholder="Nhập tin nhắn của bạn..."
              className="flex-1 bg-transparent text-[13px] text-[#f0e6d2] placeholder-[#948875] focus:outline-none select-text"
            />

            {/* Nút mở rộng lại lịch sử nếu đang ở chế độ chỉ hiện thanh nhập (BAR) */}
            {viewMode === 'BAR' && (
              <button
                type="button"
                data-nodrag="true"
                onClick={() => setViewMode('FULL')}
                title="Hiện lại khung lịch sử tin nhắn"
                className="px-1.5 py-0.5 bg-[#122032] border border-[#785a28] text-[10px] text-[#c8aa6e] hover:text-white shrink-0"
              >
                Hiện chat {unreadCount > 0 ? `(${unreadCount})` : ''}
              </button>
            )}

            {/* Nút mũi tên gửi màu vàng đồng bên phải */}
            <button
              type="submit"
              data-nodrag="true"
              title="Gửi tin nhắn"
              className="p-0.5 text-[#c8aa6e] hover:text-[#f0e6d2] active:scale-95 transition shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-current">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}