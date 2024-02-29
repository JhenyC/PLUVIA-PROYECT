const mqtt = require('mqtt');
const io = require('socket.io-client');

// Conectar al broker MQTT
const client = mqtt.connect('mqtt://localhost'); // Ajusta la URL según tu configuración de Mosquitto

// Conectar a tu servidor Socket.io (en este caso, asumiendo que tu servidor está en el mismo host y puerto 3000)
const socket = io('http://localhost:3000');

client.on('connect', () => {
  console.log('Conectado al broker MQTT');

  // Suscribirse a tópicos
  client.subscribe('monitoreo/Temperatura');
  client.subscribe('monitoreo/Humedad');

  // Manejar mensajes recibidos
  client.on('message', (topic, message) => {
    console.log(`Recibido mensaje en el tópico ${topic}: ${message.toString()}`);

    // Emitir el mensaje al servidor Socket.io
    socket.emit('mqttMessage', { topic, message: message.toString() });
  });
});

// Manejar eventos de error
client.on('error', (error) => {
  console.error('Error en la conexión MQTT:', error);
});
