import WebSocket from "ws";

//here customWebsocket extends the websocket for the types and we are adding addtional props
//custom promps in the websockets
export interface CustomWebSocket extends WebSocket {
    id?: string;
    room?: string | null;
    name?: string | null;
}

//type declaration for the messagebody
export interface messageBody {
    actionType?: string | null,
    name?: string | null,
    roomId?: string | null,
    message?: string | null
}