import { createContext } from 'react';

export const notificationContext = createContext({
    notification: [],
    setNotification: () => {},
});

export const NotificationProvider = notificationContext.Provider;
// export default notificationContext;