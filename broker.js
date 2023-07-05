const net = require('net');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class Consumer {
  socket;
  name;
  constructor(socket, name) {
    this.socket = socket;
    this.name = name;
  }
  consume(data) {
    this.socket.write(
      toJSONBuffer({
        type: 'incoming_data',
        data: data.data,
      })
    );
  }
}

class Message {
  name;
  socket;
  consumers = [];
  event;
  assertedEvents = [];

  consume(name, socket) {
    const newConsumer = new Consumer(socket, name);
    this.consumers.push(newConsumer);
  }

  incoming(data) {
    this.event.emit('incoming', data);
  }

  assert(name) {
    this.assertedEvents.push(name);
  }

  constructor(name, socket) {
    this.event = new EventEmitter();
    this.name = name;
    this.socket = socket;

    this.event.on('incoming', (data, socket) => {
      if (!this.assertedEvents.includes(data.name)) {
        socket.write(
          toJSONBuffer({
            type: 'error',
            message: 'the event name is not asserted',
          })
        );
      }
      const filterConsumers = this.consumers.filter(
        (consumer) => consumer.name === data.name
      );
      filterConsumers.forEach((consumer) => {
        consumer.consume(data);
      });
    });
  }
}

let messages = [];

const emitter = new EventEmitter();

const events = ['assert', 'consume', 'new_channel', 'incoming'];

var server;

emitter.on('assert', (data, socket) => {
  const message = messages.find((m) => m.name === data.channel);
  if (!message) {
    return socket.write(
      toJSONBuffer({
        type: 'error',
        message: "the channel doesn't exist",
      })
    );
  }
  message.assert(data.name);
  socket.write(
    toJSONBuffer({
      type: 'general',
      message: 'the type has been asserted',
    })
  );
});

emitter.on('consume', (data, socket) => {
  const message = messages.find((m) => m.name === data.channel);
  if (!message) {
    return socket.write(
      toJSONBuffer({
        type: 'error',
        message: "the channel doesn't exist",
      })
    );
  }
  if (!message.assertedEvents.includes(data.name)) {
    return socket.write(
      toJSONBuffer({
        type: 'error',
        message: 'consume type is not asserted',
      })
    );
  }
  message.consume(data.name, socket);
  socket.write(
    toJSONBuffer({
      type: 'general',
      message: `consuming from ${data.name}`,
    })
  );
});

emitter.on('new_channel', (data, socket) => {
  const message = new Message(data.name, socket);
  socket.write(
    toJSONBuffer({
      type: 'general',
      message: `new channel with name ${data.name} is created`,
    })
  );
  messages.push(message);
});

emitter.on('incoming', (data, socket) => {
  const message = messages.find((m) => m.name === data.channel);
  if (!message) {
    return socket.write(
      toJSONBuffer({
        type: 'error',
        message: "the channel doesn't exist",
      })
    );
  }
  socket.write(
    toJSONBuffer({
      type: 'general',
      message: 'the data has been enqueued to send',
    })
  );
  message.incoming(data);
});

function toJSONBuffer(data) {
  return Buffer.from(JSON.stringify(data));
}

function parse(data, socket) {
  if (data.header === 'initial') {
    if (events.includes(data.type)) {
      emitter.emit(data.type, data, socket);
    }
  } else if (data.header === 'general') {
    if (events.includes(data.type)) {
      emitter.emit(data.type, data, socket);
    }
  }
}

server = net.createServer((socket) => {
  socket
    .on('connect', () => {})
    .on('data', (data) => {
      const uid = crypto.randomUUID();
      socket.uid = uid;
      parse(JSON.parse(data), socket);
    })
    .on('error', () => {
      messages.forEach((message) => {
        if (message.socket.uid === socket.uid) {
          messages = messages.filter((ms) => ms.socket.uid !== socket.uid);
          return;
        }
      });
      console.log('A connection has been closed');
    });
});

server.listen(4567, () => {
  console.log('Message broker service started');
});
