'use strict';

////////////////////////////////////////////////////
// 客户端创建或加入房间

var isRoomCreators = false;
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
  if (isRoomCreators) {
    start();
  }
});

socket.on('full', function(room) {
  console.log('Room: ' + room + ' is full');
});

////////////////////////////////////////////////////
// 同一个房间内的客户端互换信息，并打开数据通道

var sender = document.querySelector('textarea#sender');
var receiver = document.querySelector('textarea#receiver');
var peerConn;
var dataChannel;
var pcConfig = {
  'iceServers': [{
    'urls': 'turn:139.199.82.200:3478',
    'username': 'yhd',
    'credential': 'yhd1234'
  }]
};

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'Data Channel Created') {
    start();
  } else if (message === 'Data Channel Ready') {
    doOffer();
  } else if (message.type === 'offer') {
    peerConn.setRemoteDescription(new RTCSessionDescription(message.description));
    doAnswer();
  } else if (message.type === 'answer') {
    peerConn.setRemoteDescription(new RTCSessionDescription(message.description));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      candidate: message.candidate
    });
    peerConn.addIceCandidate(candidate);
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

function start() {
  console.log('Creating peer connection');
  try {
    peerConn = new RTCPeerConnection(pcConfig);
    peerConn.onicecandidate = handleIceCandidate;
    console.log('Created peer connection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    return;
  }
  if (isRoomCreators) {
    console.log('Creating Data Channel');
    dataChannel = peerConn.createDataChannel('myLabel', {
      ordered: true,
    });
    // onDataChannelCreated(dataChannel);
    dataChannel.onopen = function() {
      console.log('Data Channel opened.');
    };
    dataChannel.onclose = function() {
      console.log('Data Channel closed.');
    }
    sendMessage('Data Channel Created');
  } else {
    peerConn.ondatachannel = function(event) {
      console.log('ondatachannel:', event.channel);
      dataChannel = event.channel;
      // onDataChannelCreated(dataChannel);
      dataChannel.onclose = function() {
        console.log('Data Channel closed.');
      }
      dataChannel.onmessage = function(event) {
        var data = event.data;
        console.log('receive : ' + data);
        receiver.value = data;
      };
    };
    sendMessage('Data Channel Ready');
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      candidate: event.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function onDataChannelCreated(dataChannel) {
  dataChannel.onopen = function() {
    console.log('Data Channel opened.');
  };

  dataChannel.onclose = function() {
    console.log('Data Channel closed.');
  }

  dataChannel.onmessage = function(event) {
    var data = event.data;
    console.log('receive : ' + data);
    receiver.value = data;
  };

  dataChannel.onerror = function (error) {
    console.log("Data Channel Error:", error);
  };
}

function doOffer() {
  console.log('Sending offer to peer');
  try {
    let offer = peerConn.createOffer();
    console.log('offer: ', offer);
    console.log('offer.RTCSessionDescription: ', offer['[[PromiseValue]]']);
    peerConn.setLocalDescription(offer['[[PromiseValue]]']);
    sendMessage({
      type: 'offer',
      description: offer
    });
  } catch (e) {
    console.error('Failed to create offer: ', e);
  }
}

function doAnswer() {
  console.log('Sending answer to peer');
  try {
    let answer = peerConn.createAnswer();
    console.log('answer: ', answer);
    peerConn.setLocalDescription(answer);
    sendMessage({
      type: 'answer',
      description: answer
    });
  } catch (e) {
    console.error('Failed to create answer: ', e);
  }
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  isRoomCreators = false;
  peerConn.close();
  peerConn = null;
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

////////////////////////////////////////////////////
// 添加按钮事件

var sendButton = document.querySelector('button#sendButton');

sendButton.addEventListener('click', send);

function send() {
  let content = sender.value;
  console.log('send : [' + content + ']');

  if (!dataChannel) {
    logError('Connection has not been initiated. Get two peers in the same room first');
    return;
  } else if (dataChannel.readyState === 'closed') {
    logError('Connection was lost. Peer closed the connection.');
    return;
  } 

  console.log('RTCDataChannel', dataChannel.readyState);
  dataChannel.send(content);
}