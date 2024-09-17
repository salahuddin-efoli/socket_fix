import { createContext } from 'react';

const newTicketIdContext = createContext({
    id: null,
    setId: () => {},
});

export const NewTicketIdContextProvider = newTicketIdContext.Provider;
export default newTicketIdContext;