import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
//Port on which our http server will run
const PORT = process.env.PORT || '8080';
//express middleware handler app
const app = express();
//corst
app.use(cors());
//json format
app.use(express.json());
//creating the server instance 
//passing the app as it is also a main route handler.
const server = http.createServer(app);
//on the default port lets set any thing
app.use("/", (req, res) => {
    res.status(200).json("trying to hit the server");
});
//we will start the websocketserver that will take the http server as a argument to upgrade the request to ws.
const wss = new WebSocketServer({ server: server });
//creating the new room map 
//store rooms: {roomId: set of clients}
//against the room id there will be all the ws connection on the same room.
const rooms = new Map();
//function to get the data and passed on the websocket channel in the string format. 
function sendMessage(ws, type, payload) {
    //sending the data in the string format on the channel.
    ws.send(JSON.stringify({ type, ...payload }));
    console.log({ type, ...payload });
}
wss.on("connection", (ws) => {
    //setting the id to the connection
    //room and name should be null at the start of the connection
    ws.id = uuidv4();
    ws.room = null;
    ws.name = null;
    //console for the successfull connection
    console.log('Successfull connection');
    //Let's set the event handlers for the websocket connection.
    ws.on('message', (messageBody) => {
        try {
            const data = JSON.parse(messageBody);
            //destructuring the important data from the body.
            let { actionType, name, roomId, message } = data;
            roomId = roomId?.toLowerCase();
            console.log(data);
            switch (actionType) {
                case 'create-room': {
                    const newRoom = uuidv4().slice(0, 6); //6 - char room code;
                    //setting the set against the roomId
                    rooms.set(newRoom, new Set([ws]));
                    ws.room = newRoom;
                    ws.name = name;
                    //pass the event room created.
                    sendMessage(ws, 'room-created', { roomId: newRoom });
                    break;
                }
                case 'join-room': {
                    if (!rooms.has(roomId)) {
                        sendMessage(ws, 'error', { message: 'Room not found!' });
                    }
                    //get the set of the ws connection with props
                    const room = rooms.get(roomId);
                    room.add(ws);
                    ws.room = roomId;
                    ws.name = name;
                    //sending the roomId
                    sendMessage(ws, 'room-joined', { roomId: roomId });
                    //notify others with the newly joined member.
                    room.forEach((client) => {
                        if (client !== ws && client.readyState === ws.OPEN) {
                            sendMessage(client, 'user-joined', { name: name });
                        }
                    });
                    break;
                }
                case 'chat': {
                    if (!ws.room)
                        return;
                    //getting the room to broadcast the message
                    const room = rooms.get(ws.room);
                    //broadcasting the message in the channel.
                    room.forEach((client) => {
                        if (client.readyState === ws.OPEN) {
                            sendMessage(client, 'chat', {
                                name: ws.name,
                                message: message
                            });
                        }
                    });
                    break;
                }
                default:
                    sendMessage(ws, 'error', { message: 'Invalid message type!' });
            }
        }
        catch (e) {
            sendMessage(ws, 'error', { message: 'Invalid JSON format!' });
        }
    });
    //On closing the client
    ws.on('close', () => {
        //the websocket was not in the room so no problem just return from here.
        if (!ws.room)
            return;
        //getting the room from the roomId of the connection.
        const room = rooms.get(ws.room);
        //If room also not exist then return from here no action needed.
        if (!room)
            return;
        //in the success delete the websocket connection from the room.
        room.delete(ws);
        //after deleting check if there is anyone in the room
        if (room.size === 0) {
            //deleting the roomId (as there is no ws (connections) are active)
            rooms.delete(ws.room);
        }
        else {
            //broadcast the message of user left in the room.
            room.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    sendMessage(client, 'user-left', { name: ws.name });
                }
            });
        }
    });
});
//starting the server on the desired port
server.listen({ port: PORT, host: '0.0.0.0' }, () => {
    console.log(`Server is running on port ${PORT}`);
});
