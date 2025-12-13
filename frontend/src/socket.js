import { io } from "socket.io-client";

const URL = "http://localhost:3000"; // địa chỉ server socket.io ở backend

export const socket = io(URL, {
  autoConnect: true,
});
