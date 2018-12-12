'use strict';
// 兼容chrome和firefox浏览器

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
var dataChannelSender;
var dataChannelReceiver;
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
    peerConn.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer') {
    peerConn.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.sdpMLineIndex,
      sdpMid: message.sdpMid,
      candidate: message.candidate
    });
    peerConn.addIceCandidate(candidate);
  }
});

function start() {
  console.log('Creating peer connection');
  try {
    peerConn = new RTCPeerConnection(pcConfig);
    peerConn.onicecandidate = function(event) {
      console.log('icecandidate event: ', event);
      if (event.candidate) {
        sendMessage({
          type: 'candidate',
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        });
      } else {
        console.log('End of candidates.');
      }
    };
    console.log('Created peer connection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    return;
  }

  if (isRoomCreators) {
    console.log('Creating Data Channel');
    dataChannelSender = peerConn.createDataChannel('testLabel', {
      ordered: true,
    });
    initDataChannel(dataChannelSender);
    sendMessage('Data Channel Created');
  } else {
    peerConn.ondatachannel = function(event) {
      console.log('ondatachannel:', event.channel);
      dataChannelReceiver = event.channel;
      initDataChannel(dataChannelReceiver);
    };
    sendMessage('Data Channel Ready');
  }
}

function initDataChannel(dataChannel) {
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
  peerConn.createOffer(function(description) {
    peerConn.setLocalDescription(description);
    sendMessage(description);
  }, function(e) {
    console.log('createOffer error: ', e);
  });
}

function doAnswer() {
  console.log('Sending answer to peer');
  peerConn.createAnswer(function(description) {
      peerConn.setLocalDescription(description);
      sendMessage(description);
    }, function(e) {
    console.log('createAnswer error: ', e);
  });
}

////////////////////////////////////////////////////
// 添加按钮事件

var sendButton = document.querySelector('button#sendButton');
sendButton.addEventListener('click', function() {
  let content = sender.value;
  console.log('send : [' + content + ']');

  if (!dataChannelSender) {
    console.log('Connection has not been initiated. Get two peers in the same room first');
  } else if (dataChannelSender.readyState === 'closed') {
    console.log('Connection was lost. Peer closed the connection.');
  } else if (dataChannelSender.readyState === 'connecting') {
    console.log('Connection is connecting.');
  } else {
    console.log('RTCDataChannel', dataChannelSender.readyState);
    dataChannelSender.send(content);
  }
});

// 关闭，刷新，后退都会触发，我们测试时关闭双方网页，这样不会出现问题
window.onbeforeunload = function() {
  sendMessage('bye');
};