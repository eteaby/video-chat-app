import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';
import './App.css';

const socket = io.connect('http://localhost:5000');

function App() {
  const [me, setMe] = useState('');
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState('');
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState('');
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState('');
  const [muteAudio, setMuteAudio] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setStream(stream);
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
      })
      .catch((error) => {
        console.error('Error accessing media devices:', error);
      });

    socket.on('me', (id) => {
      setMe(id);
    });

    socket.on('callUser', (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setName(data.name);
      setCallerSignal(data.signal);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCopy = () => {
    console.log('Copying ID:', me);
  };

  const callUser = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    peer.on('signal', (data) => {
      socket.emit('callUser', {
        userToCall: id,
        signalData: data,
        from: me,
        name: name,
      });
    });

    peer.on('stream', (stream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    });

    socket.on('callAccepted', (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on('signal', (data) => {
      socket.emit('answerCall', { signal: data, to: caller });
    });

    peer.on('stream', (stream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    });

    peer.signal(callerSignal);

    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }
  };

  const toggleMuteAudio = () => {
    setMuteAudio((prevMuteAudio) => !prevMuteAudio);
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !muteAudio;
      });
    }
  };

  const toggleCamera = () => {
    setCameraOn((prevCameraOn) => !prevCameraOn);
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !cameraOn;
      });
    }
  };

  return (
    <>
      <header>Video Chat App</header>
      <div className="container">
        <div className="controls">
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <CopyToClipboard text={me} onCopy={handleCopy}>
            <button className="copy-id-button">Copy ID</button>
          </CopyToClipboard>
        </div>

        <div className="video-container">
          <div className="video">
            {stream && <video playsInline muted ref={myVideo} autoPlay />}
            <div className="video-buttons">
              <button onClick={toggleMuteAudio}>
                {muteAudio ? <FaMicrophoneSlash /> : <FaMicrophone />}
              </button>
              <button onClick={toggleCamera}>
                {cameraOn ? <FaVideoSlash /> : <FaVideo />}
              </button>
            </div>
          </div>
          <div className="video">
            {callAccepted && !callEnded && <video playsInline ref={userVideo} autoPlay />}
          </div>
        </div>

        <div className="controls">
          <input
            type="text"
            placeholder="ID to Call"
            value={idToCall}
            onChange={(e) => setIdToCall(e.target.value)}
          />
          {callAccepted && !callEnded ? (
            <button onClick={leaveCall}>End Call</button>
          ) : (
            <button onClick={() => callUser(idToCall)}>Call</button>
          )}
        </div>

        {receivingCall && !callAccepted && (
          <div className="caller-notification">
            <h2>{name} is calling...</h2>
            <button onClick={answerCall}>Answer</button>
            <button onClick={() => setReceivingCall(false)}>Decline</button>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
