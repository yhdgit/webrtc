'use strict';
// 支持 平台：macOS、windows；浏览器：chrome、firefox。
/**
 * firefox的RTCIceCandidate必须要有以下两个参数
 * sdpMLineIndex
 * sdpMid
 * chrome则不需要
 */

////////////////////////////////////////////////////
// 客户端创建或加入房间

var isRoomCreators = false;
var room = 'testRoom';
var socket = io.connect();

console.log('attempted to create or join room: ', room);
socket.emit('create or join', room);

socket.on('created', function(room) {
  console.log('created room: ', room);
  isRoomCreators = true;
});

socket.on('other joining', function (room) {
  console.log('other peer made a request to join room: ', room);
});

socket.on('joined', function(room) {
  console.log('joined room: ', room);
});

socket.on('ready', function() {
  console.log('both sides are ready');
  if (isRoomCreators) {
    start();
  }
});

socket.on('full', function(room) {
  console.log('room: ' + room + ' is full');
});

////////////////////////////////////////////////////
// 同一个房间内的客户端互换信息，并打开数据通道

var sender = document.querySelector('textarea#sender');
var receiver = document.querySelector('textarea#receiver');
var peerConn;
var dataChannel;
var pcConfig = {
  'iceServers': [{
    urls: 'turn:139.199.82.200:3478',
    username: 'yhd',
    credential: 'yhd1234',
  },]
};

function sendMessage(message) {
  console.log('sending message: ', message);
  socket.emit('message', message);
}

socket.on('message', function(message) {
  console.log('received message: ', message);
  if (message === 'dataChannel created') {
    start();
  } else if (message === 'dataChannel ready') {
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
      candidate: message.candidate,
    });
    peerConn.addIceCandidate(candidate);
  }
});

function start() {
  console.log('creating RTCPeerConnection');
  try {
    peerConn = new RTCPeerConnection(pcConfig);
    peerConn.onicecandidate = function(event) {
      console.log('onicecandidate, event: ', event);
      if (event.candidate) {
        sendMessage({
          type: 'candidate',
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        });
      } else {
        console.log('end of candidate');
      }
    };
    console.log('created RTCPeerConnection');
  } catch (e) {
    console.log('failed to create RTCPeerConnection, exception: ' + e.message);
    return;
  }

  if (isRoomCreators) {
    console.log('creating dataChannel');
    dataChannel = peerConn.createDataChannel('testLabel', {
      ordered: true,
    });
    initDataChannel(dataChannel);
    sendMessage('dataChannel created');
  } else {
    peerConn.ondatachannel = function(event) {
      console.log('ondatachannel:', event.channel);
      dataChannel = event.channel;
      initDataChannel(dataChannel);
    };
    sendMessage('dataChannel ready');
  }
}

function initDataChannel(dataChannel) {
  dataChannel.onopen = function() {
    console.log('dataChannel opened.');
  };

  dataChannel.onclose = function() {
    console.log('dataChannel closed.');
  }

  dataChannel.onmessage = function(event) {
    receiver.value = event.data;
  };

  dataChannel.onerror = function (error) {
    console.log("dataChannel error: ", error);
  };
}

function doOffer() {
  console.log('sending offer');
  peerConn.createOffer(function(description) {
    peerConn.setLocalDescription(description);
    sendMessage(description);
  }, function(e) {
    console.log('createOffer error: ', e);
  });
}

function doAnswer() {
  console.log('sending answer');
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
  var content = sender.value;
  console.log('send : [' + content + ']');

  if (!dataChannel) {
    console.log('dataChannel has not been initiated');
  } else if (dataChannel.readyState === 'closed') {
    console.log('dataChannel was closed');
  } else if (dataChannel.readyState === 'connecting') {
    console.log('dataChannel is connecting');
  } else {
    console.log('DataChannel.readyState', dataChannel.readyState);
    dataChannel.send(content);
  }
});

// 关闭，刷新，后退都会触发
window.onbeforeunload = function() {
  sendMessage('bye');
};