import { createContext } from 'react';

export const newCreatedTicketContext = createContext({
    newTicket: null,
    setNewTicket: () => {},
});

export const NewCreatedTicketProvider = newCreatedTicketContext.Provider;
// export default notificationContext;