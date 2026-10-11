import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  useAddUserMutation,
  useGetAllAttendanceQuery,
  useGetMyAttendanceQuery,
  useGetMyOvertimeQuery,
  useGetOvertimeQuery,
  useGetUsersQuery,
  useLoginMutation,
  usePunchInMutation,
  usePunchOutMutation,
  useRequestOvertimeMutation,
  useReviewAttendanceMutation,
  useReviewOvertimeMutation,
  useSignupMutation,
} from './features/api';
import { api } from './features/api';

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—';
const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const messageFor = (error) => error?.data?.message || error?.message || 'Something went wrong. Please try again.';
const noRows = [];
const shiftStatus = (row) => !row.punchOut ? 'in progress' : Number(row.totalWorkingHours || 0) >= 8 ? 'completed' : 'incomplete';

function getBrowserLocation(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      reject,
      options,
    );
  });
}

async function requestLocation() {
  if (!navigator.geolocation) throw new Error('Location is not available in this browser. Try Chrome or Safari on localhost.');
  try {
    const location = await getBrowserLocation({ enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
    return { latitude: location.latitude, longitude: location.longitude, source: 'device' };
  } catch (error) {
    if (error.code === 1) {
      throw new Error('Location permission is blocked. In Chrome, click the icon left of localhost, open Site settings, set Location to Allow, then reload the page.');
    }
    try {
      const location = await getBrowserLocation({ enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 });
      return { latitude: location.latitude, longitude: location.longitude, source: 'device' };
    } catch (retryError) {
      if (retryError.code === 1) {
        throw new Error('Location permission is blocked. In Chrome, click the icon left of localhost, open Site settings, set Location to Allow, then reload the page.');
      }
      if (!window.confirm('Your device could not provide a location. Use an approximate location based on your internet connection? This sends your public IP address to IPWho. The result may be less accurate than GPS.')) {
        throw new Error('Approximate location was not used. Turn on device Location Services and try again.');
      }
      try {
        const response = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(8000) });
        const result = await response.json();
        if (!response.ok || !result.success || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
          throw new Error('Network location is unavailable.');
        }
        return { latitude: result.latitude, longitude: result.longitude, source: 'network' };
      } catch {
        throw new Error('Your device could not find its location and approximate network location is unavailable. Check Location Services and your internet connection, then try again.');
      }
    }
  }
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: 'employee@example.com', password: 'DemoPass123!' });
  const [message, setMessage] = useState('');
  const [login, loginState] = useLoginMutation();
  const [signup, signupState] = useSignupMutation();
  const busy = loginState.isLoading || signupState.isLoading;

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const result = mode === 'login'
        ? await login({ email: form.email, password: form.password }).unwrap()
        : await signup(form).unwrap();
      onLogin(result);
    } catch (error) {
      setMessage(messageFor(error));
    }
  };

  return <main className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand-mark">A</div>
      <p className="eyebrow">ATTENDANCE MANAGEMENT</p>
      <h1>{mode === 'login' ? 'Welcome back' : 'Create an employee account'}</h1>
      <p className="muted">Sign in to record and review work attendance.</p>
      {mode === 'signup' && <label>Name<input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>}
      <label>Email<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
      <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
      {message && <div className="notice error">{message}</div>}
      <button className="button primary wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      <p className="auth-toggle">{mode === 'login' ? 'New employee?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Sign up' : 'Sign in'}</button></p>
      {mode === 'login' && <div className="demo-logins"><b>Demo sign-ins</b><div className="row"><button type="button" className="button small secondary" onClick={() => setForm({ ...form, email: 'employee@example.com', password: 'DemoPass123!' })}>Employee</button><button type="button" className="button small secondary" onClick={() => setForm({ ...form, email: 'manager@example.com', password: 'DemoPass123!' })}>Manager</button><button type="button" className="button small secondary" onClick={() => setForm({ ...form, email: 'admin@example.com', password: 'DemoPass123!' })}>Admin</button></div><small>Password for each: DemoPass123!</small></div>}
    </form>
  </main>;
}

function CameraDialog({ onClose, onCapture, locationSource }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(() => navigator.mediaDevices?.getUserMedia ? '' : 'Camera access is not available in this browser.');
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return undefined;
    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (active && videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError('Camera access was blocked. Allow camera access and try again.'));
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.75));
  };

  return <div className="modal-backdrop"><section className="camera-dialog">
    <div className="row between"><div><p className="eyebrow">ATTENDANCE PHOTO</p><h2>Take a live selfie</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>
    {error ? <div className="notice error">{error}</div> : <video ref={videoRef} autoPlay playsInline muted />}
    <p className="muted">The photo is taken from your camera. File uploads are not used.</p>
    {locationSource === 'network' && <p className="notice">Device location was unavailable. This attendance will use an approximate location from your internet connection (IPWho); it may be less accurate than GPS.</p>}
    <div className="row end"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!!error} onClick={capture}>Capture selfie</button></div>
  </section></div>;
}

function App() {
  const dispatch = useDispatch();
  const [session, setSession] = useState(() => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      return token && user ? { token, user } : null;
    } catch { return null; }
  });
  const [notice, setNotice] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [cameraAction, setCameraAction] = useState(null);
  const locationRef = useRef(null);
  const [overtimeForm, setOvertimeForm] = useState({ attendanceId: '', hours: '', reason: '' });
  const [accountForm, setAccountForm] = useState({ name: '', email: '', password: '', role: 'employee', manager: '' });
  const [remarks, setRemarks] = useState({});
  const role = session?.user?.role;
  const isEmployee = role === 'employee';
  const canReview = role === 'manager' || role === 'admin';

  const attendanceArgs = filterDate ? { date: filterDate } : {};
  const mine = useGetMyAttendanceQuery(undefined, { skip: !session || !isEmployee });
  const team = useGetAllAttendanceQuery(attendanceArgs, { skip: !session || isEmployee });
  const rows = isEmployee ? (mine.data?.attendance || noRows) : (team.data?.attendance || noRows);
  const mineOT = useGetMyOvertimeQuery(undefined, { skip: !session || !isEmployee });
  const allOT = useGetOvertimeQuery(undefined, { skip: !session || !canReview });
  const usersQuery = useGetUsersQuery(undefined, { skip: role !== 'admin' });
  const [punchIn, punchInState] = usePunchInMutation();
  const [punchOut, punchOutState] = usePunchOutMutation();
  const [requestOT, requestOTState] = useRequestOvertimeMutation();
  const [reviewOT] = useReviewOvertimeMutation();
  const [reviewAttendance] = useReviewAttendanceMutation();
  const [addUser, addUserState] = useAddUserMutation();

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleLogin = (result) => {
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    setSession({ token: result.token, user: result.user });
  };
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession(null);
    dispatch(api.util.resetApiState());
  };

  const openCamera = async (type) => {
    setNotice('Finding your location…');
    try {
      locationRef.current = await requestLocation();
      setNotice(locationRef.current.source === 'network' ? 'Using approximate location from your internet connection. Enable device Location Services for a more accurate result.' : '');
      setCameraAction({ type, locationSource: locationRef.current.source });
    } catch (error) {
      locationRef.current = null;
      setNotice(error.message);
    }
  };
  const submitPunch = async (selfie) => {
    const action = cameraAction;
    setCameraAction(null);
    try {
      const location = locationRef.current;
      if (!location) throw new Error('Location was not captured. Please try again.');
      if (action.type === 'in') await punchIn({ selfie, ...location }).unwrap();
      else await punchOut({ selfie, ...location }).unwrap();
      locationRef.current = null;
      setNotice(action.type === 'in' ? 'Punch in saved.' : 'Punch out saved.');
    } catch (error) {
      locationRef.current = null;
      setNotice(error.message || messageFor(error));
    }
  };

  const submitOvertime = async (event) => {
    event.preventDefault();
    try {
      await requestOT({
        attendanceId: overtimeForm.attendanceId,
        hours: Number(overtimeForm.hours),
        reason: overtimeForm.reason.trim(),
      }).unwrap();
      setOvertimeForm({ attendanceId: '', hours: '', reason: '' });
      setNotice('Overtime request sent.');
    } catch (error) { setNotice(messageFor(error)); }
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    try {
      await addUser({ ...accountForm, manager: accountForm.manager || null }).unwrap();
      setAccountForm({ name: '', email: '', password: '', role: 'employee', manager: '' });
      setNotice('Account created.');
    } catch (error) { setNotice(messageFor(error)); }
  };

  const updateOvertime = async (id, status) => {
    try {
      await reviewOT({ id, status, remarks: remarks[id] || '' }).unwrap();
      setNotice(`Overtime ${status}.`);
    } catch (error) { setNotice(messageFor(error)); }
  };
  const updateAttendance = async (id, validationStatus) => {
    try {
      await reviewAttendance({ id, validationStatus, remarks: remarks[id] || '' }).unwrap();
      setNotice('Attendance review saved.');
    } catch (error) { setNotice(messageFor(error)); }
  };

  const completed = rows.filter((row) => row.punchOut && row.overtimeStatus === 'none');
  const active = rows.find((row) => !row.punchOut);
  const pendingOT = (allOT.data?.overtime || []).filter((item) => item.status === 'pending');
  const summary = useMemo(() => ({
    days: rows.length,
    hours: rows.reduce((sum, row) => sum + Number(row.totalWorkingHours || 0), 0),
    completed: rows.filter((row) => shiftStatus(row) === 'completed').length,
  }), [rows]);
  const reportRows = isEmployee && filterDate
    ? rows.filter((row) => new Date(row.punchIn).toISOString().slice(0, 10) === filterDate)
    : rows;

  if (!session) return <AuthScreen onLogin={handleLogin} />;
  const queryError = isEmployee ? mine.error : team.error;

  return <div className="app-shell">
    <header className="topbar"><div><div className="brand"><span className="brand-mark small-mark">A</span><span>Attendance Management</span></div><p className="muted">A simple record of workdays and reviews.</p></div><div className="profile"><span>{session.user.name}</span><span className="role-label">{role}</span><button className="button secondary" onClick={logout}>Sign out</button></div></header>
    <main className="content">
      <section className="welcome card"><div><p className="eyebrow">{new Date().toLocaleDateString()}</p><h1>{isEmployee ? `Hello, ${session.user.name}` : role === 'manager' ? 'Team attendance' : 'Attendance overview'}</h1><p className="muted">{isEmployee ? active ? `Punched in at ${formatTime(active.punchIn)}. Use Punch out when your shift ends.` : 'Punch in to start your shift. Punch out appears here after you start.' : role === 'manager' ? 'Review your team’s attendance and overtime requests.' : 'Review all attendance, accounts and overtime requests.'}</p></div>
        {isEmployee && (active
          ? <button className="button primary" disabled={punchOutState.isLoading} onClick={() => openCamera('out')}>Punch out</button>
          : <button className="button primary" disabled={punchInState.isLoading} onClick={() => openCamera('in')}>Punch in</button>)}
      </section>

      <section className="stats">
        <Stat label="Attendance days" value={summary.days} />
        <Stat label="Completed days" value={summary.completed} />
        <Stat label="Hours recorded" value={summary.hours.toFixed(1)} />
        <Stat label={isEmployee ? 'Overtime requests' : 'Waiting for review'} value={isEmployee ? (mineOT.data?.overtime || []).length : pendingOT.length} />
      </section>

      {isEmployee && completed.length > 0 && <section className="card section-card">
        <div className="section-title"><div><p className="eyebrow">EXTRA HOURS</p><h2>Request overtime</h2></div></div>
        <form className="form-grid" onSubmit={submitOvertime}>
          <label>Attendance day<select required value={overtimeForm.attendanceId} onChange={(e) => setOvertimeForm({ ...overtimeForm, attendanceId: e.target.value })}><option value="">Select a day</option>{completed.map((row) => <option value={row._id} key={row._id}>{formatDate(row.punchIn)} · {Number(row.totalWorkingHours || 0).toFixed(2)} hours worked</option>)}</select></label>
          <label>Overtime hours<input required type="number" min="0.5" max="12" step="0.5" value={overtimeForm.hours} onChange={(e) => setOvertimeForm({ ...overtimeForm, hours: e.target.value })} /></label>
          <label className="wide-field">Reason<input required maxLength="500" value={overtimeForm.reason} onChange={(e) => setOvertimeForm({ ...overtimeForm, reason: e.target.value })} placeholder="Short reason for overtime" /></label>
          <div className="wide-field"><button className="button primary" disabled={requestOTState.isLoading}>{requestOTState.isLoading ? 'Submitting…' : 'Submit overtime request'}</button></div>
        </form>
      </section>}

      {canReview && <section className="card section-card">
        <div className="section-title"><div><p className="eyebrow">MANAGER / ADMIN</p><h2>Pending overtime requests</h2></div></div>
        {allOT.isError ? <div className="notice error">{messageFor(allOT.error)}</div> : allOT.isLoading ? <p className="muted">Loading requests…</p> : pendingOT.length === 0 ? <p className="muted">There are no requests to review.</p> : <div className="request-list">{pendingOT.map((item) => <article className="request-item" key={item._id}><div><strong>{item.employee?.name || 'Employee'}</strong><p>{item.hours} hours · {item.reason}</p><small>{formatDate(item.attendance?.punchIn)}</small><input className="remarks-input" placeholder="Optional note" value={remarks[item._id] || ''} onChange={(e) => setRemarks({ ...remarks, [item._id]: e.target.value })} /></div><div className="row"><button className="button secondary" onClick={() => updateOvertime(item._id, 'rejected')}>Reject</button><button className="button primary" onClick={() => updateOvertime(item._id, 'approved')}>Approve</button></div></article>)}</div>}
      </section>}

      {role === 'admin' && <section className="card section-card">
        <div className="section-title"><div><p className="eyebrow">ADMIN</p><h2>People</h2></div></div>
        <form className="form-grid" onSubmit={submitAccount}>
          <label>Name<input required value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} /></label>
          <label>Email<input required type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} /></label>
          <label>Temporary password<input required type="password" minLength="8" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} /></label>
          <label>Role<select value={accountForm.role} onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value, manager: '' })}><option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label>
          {accountForm.role === 'employee' && <label>Manager<select value={accountForm.manager} onChange={(e) => setAccountForm({ ...accountForm, manager: e.target.value })}><option value="">No manager assigned</option>{(usersQuery.data?.users || []).filter((user) => user.role === 'manager').map((manager) => <option key={manager._id} value={manager._id}>{manager.name}</option>)}</select></label>}
          <div className="wide-field"><button className="button primary" disabled={addUserState.isLoading}>{addUserState.isLoading ? 'Saving…' : 'Add account'}</button></div>
        </form>
        <div className="people-list">{(usersQuery.data?.users || []).map((person) => <div className="person-row" key={person._id}><span>{person.name}</span><span>{person.email}</span><span>{person.role}{person.manager?.name ? ` · ${person.manager.name}` : ''}</span></div>)}</div>
      </section>}

      <section className="card section-card">
        <div className="section-title"><div><p className="eyebrow">REPORT</p><h2>{isEmployee ? 'My attendance' : 'Attendance records'}</h2></div><label className="date-filter">Date <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /></label></div>
        {queryError ? <div className="notice error">{messageFor(queryError)}</div> : isEmployee ? <EmployeeRecords rows={reportRows} overtime={mineOT.data?.overtime || []} isLoading={mine.isLoading} /> : <div className="table-scroll">{team.isLoading ? <p className="muted">Loading attendance…</p> : <><table><thead><tr><th>Employee</th><th>Date</th><th>Punch in</th><th>Punch out</th><th>Hours</th><th>Locations</th><th>Status</th><th>Selfie review</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{row.employee?.name}<small>{row.employee?.email}</small></td><td>{formatDate(row.punchIn)}</td><td>{formatTime(row.punchIn)}</td><td>{formatTime(row.punchOut)}</td><td>{Number(row.totalWorkingHours || 0).toFixed(2)}</td><td><a href={`https://maps.google.com/?q=${row.location?.latitude},${row.location?.longitude}`} target="_blank" rel="noreferrer">Punch in</a>{row.punchOutLocation?.latitude != null && <> · <a href={`https://maps.google.com/?q=${row.punchOutLocation.latitude},${row.punchOutLocation.longitude}`} target="_blank" rel="noreferrer">Punch out</a></>}</td><td><span className="status">{shiftStatus(row)}{row.overtimeStatus !== 'none' ? ` · OT ${row.overtimeStatus}` : ''}</span></td><td><div className="review-cell"><div><a href={row.selfie} target="_blank" rel="noreferrer">In selfie</a>{row.punchOutSelfie && <> · <a href={row.punchOutSelfie} target="_blank" rel="noreferrer">Out selfie</a></>}</div><input className="remarks-input" placeholder="Review note" value={remarks[row._id] || ''} onChange={(e) => setRemarks({ ...remarks, [row._id]: e.target.value })} /><span>Photo: {row.validationStatus}{row.remarks ? ` · ${row.remarks}` : ''}</span><div className="row"><button className="button small secondary" onClick={() => updateAttendance(row._id, 'valid')}>Valid</button><button className="button small secondary" onClick={() => updateAttendance(row._id, 'invalid')}>Invalid</button></div></div></td></tr>)}</tbody></table>{rows.length === 0 && <p className="empty">No attendance records for this date.</p>}</>}</div>}
      </section>
    </main>
    {notice && <div className="toast">{notice}</div>}
    {cameraAction && <CameraDialog locationSource={cameraAction.locationSource} onClose={() => { locationRef.current = null; setCameraAction(null); }} onCapture={submitPunch} />}
  </div>;
}

function Stat({ label, value }) { return <div className="stat card"><span>{label}</span><strong>{value}</strong></div>; }

function EmployeeRecords({ rows, overtime, isLoading }) {
  if (isLoading) return <p className="muted">Loading attendance…</p>;
  return <>
    <div className="table-scroll"><table><thead><tr><th>Date</th><th>Punch in</th><th>Punch out</th><th>Hours</th><th>Status</th><th>Overtime</th><th>Photos</th><th>Locations</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td>{formatDate(row.punchIn)}</td><td>{formatTime(row.punchIn)}</td><td>{formatTime(row.punchOut)}</td><td>{Number(row.totalWorkingHours || 0).toFixed(2)}</td><td>{shiftStatus(row)}</td><td>{row.overtimeStatus}</td><td><a href={row.selfie} target="_blank" rel="noreferrer">In</a>{row.punchOutSelfie && <> · <a href={row.punchOutSelfie} target="_blank" rel="noreferrer">Out</a></>}</td><td><a href={`https://maps.google.com/?q=${row.location?.latitude},${row.location?.longitude}`} target="_blank" rel="noreferrer">In{row.location?.source === 'network' ? ' (approx.)' : ''}</a>{row.punchOutLocation?.latitude != null && <> · <a href={`https://maps.google.com/?q=${row.punchOutLocation.latitude},${row.punchOutLocation.longitude}`} target="_blank" rel="noreferrer">Out{row.punchOutLocation?.source === 'network' ? ' (approx.)' : ''}</a></>}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="empty">No attendance records yet.</p>}</div>
    <h3 className="subheading">My overtime requests</h3>
    {overtime.length === 0 ? <p className="muted">No overtime requests yet.</p> : <div className="request-list">{overtime.map((item) => <div className="request-item" key={item._id}><div><strong>{item.hours} hours</strong><p>{item.reason}</p><small>{formatDate(item.attendance?.punchIn)}</small></div><span className={`status ${item.status}`}>{item.status}</span></div>)}</div>}
  </>;
}

export default App;
