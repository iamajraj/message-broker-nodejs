const net = require('net');

const socket = net.createConnection({
  port: 4567,
  host: 'localhost',
});

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

socket.on('error', (err) => {
  console.log('Connection has been closed due to error');
});

socket.on('connect', async () => {
  socket.write(
    toJSONBuffer({
      header: 'general',
      channel: 'ORDER',
      type: 'incoming',
      name: 'ORDER',
      data: {
        name: 'Order 2',
        id: '234',
        total: 399,
      },
    })
  );
});

function toJSONBuffer(data) {
  return Buffer.from(JSON.stringify(data));
}

socket.on('data', (data) => {
  data = JSON.parse(data.toString());
  switch (data.type) {
    case 'general':
      console.log('** ' + data.message);
      break;
    case 'error':
      console.log('**Error -> ' + data.message);
      break;
    case 'incoming_data':
      console.log('Consumed data -> ' + data.data);
      break;
  }
});
