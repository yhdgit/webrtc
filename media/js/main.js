'use strict';

var isRoomCreators = false;  // 房间创造者
var isBothReady = false;     // 双方都在同一个房间，都准备好了

////////////////////////////////////////////////////
// 客户端创建或加入房间

var room = 'testRoom';
var socket = io.connect();

console.log('Attempted to create or join room: ', room);
socket.emit('create or join', room);

socket.on('created', function(room) {
  console.log('Created room: ' + room);
  isRoomCreators = true;
});

socket.on('other joining', function (room) {
  console.log('Other peer made a request to join room: ' + room);
});

socket.on('joined', function(room) {
  console.log('Joined room: ' + room);
});

socket.on('ready', function() {
  console.log('Both sides are ready');
  isBothReady = true;
});

socket.on('full', function(room) {
  console.log('Room: ' + room + ' is full');
});

////////////////////////////////////////////////////
// 同一个房间内的客户端互换信息，并实现视频通信

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var pcConfig = {
  'iceServers': [{
    'urls': 'turn:139.199.82.200:3478',
    'username': 'yhd',
    'credential': 'yhd1234'
  }]
};
var isStarted = false;
var localStream;
var peerConn;

console.log('Getting user media');
navigator.mediaDevices.getUserMedia({
  audio: false,
  video: true
}).then(gotStream)
  .catch(function(e) {
    console.log('GetUserMedia error: ' + e.name);
  });

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
}

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    start();
  } else if (message.type === 'offer') {
    if (!isRoomCreators && !isStarted) {
      start();
    }
    peerConn.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    peerConn.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peerConn.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

function start() {
  console.log('start() ', isStarted, localStream, isBothReady);
  if (!isStarted && typeof localStream !== 'undefined' && isBothReady) {
    console.log('Creating peer connection');
    createPeerConnection();
    isStarted = true;
    console.log('isRoomCreators: ', isRoomCreators);
    if (isRoomCreators) {
      doCall();
    }
  }
}

function createPeerConnection() {
  try {
    peerConn = new RTCPeerConnection(pcConfig);
    peerConn.onicecandidate = handleIceCandidate;
    peerConn.onaddstream = handleRemoteStreamAdded;
    peerConn.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
    peerConn.addStream(localStream);
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteVideo.srcObject = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
  remoteVideo.srcObject = null;
}

function doCall() {
  console.log('Sending offer to peer');
  peerConn.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function setLocalAndSendMessage(sessionDescription) {
  console.log('setLocalAndSendMessage. sessionDescription: ', sessionDescription);
  peerConn.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function handleCreateOfferError(event) {
  console.log('createOffer error: ', event);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  peerConn.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error.toString());
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  isRoomCreators = false;
  isBothReady = false;
  isStarted = false;
  peerConn.close();
  peerConn = null;
}

window.onbeforeunload = function() {
  sendMessage('bye');
};