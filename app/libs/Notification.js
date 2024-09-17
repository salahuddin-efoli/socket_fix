import { useState, useContext, useEffect } from 'react';
import  {io} from "socket.io-client";
import notificationContext from '../contexts/notificationContext';
export default function Notification(){
    const { notification, setNotification } = useContext(notificationContext);
    const [socket, setSocket] = useState();

    useEffect(() => {
        const socket = io("wss://socket.efoli.com/socket.io", {
           
           reconnectionDelayMax: 10000
        });
        setSocket(socket);
        // Cleanup function
        return () => {
            socket.disconnect();
        };
    }, []);
  
    useEffect(() => {
        if (!socket) return;
        socket.on("serverResForMerchant", (data) => {
            //one by one ticket id added to notification arr
            setNotification((notification)=> [...notification, data]);  
        });
    }, [socket]);

    return notification;
}
