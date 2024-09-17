import { Authenticator } from "remix-auth";
import { sessionStorage } from "./session.server";
import { FormStrategy } from "remix-auth-form";
import prisma from "../db.server";
import bcryptjs from 'bcryptjs';


// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session
export const authenticator = new Authenticator(sessionStorage, {
    sessionKey: "userEmail",
});

// Tell the Authenticator to use the form strategy
authenticator.use(
    new FormStrategy(async ({ form }) => {
        const email = form.get("email");
        const password = form.get("password");
        const user = await login(email, password);
        if (user) {
            return user;
        } else {
            return null;
        }
    }),
    // each strategy has a name and can be changed to use another one
    // same strategy multiple times, especially useful for the OAuth2 strategy.
    "user-pass"
);


export const login = async (email, password) => {
    // Find out user info by using mail
    const user = await prisma.supportAgents.findFirst({
        where: { email: email }, orderBy: { id: 'desc' }
    });
    if (user) {
        // Hash password check for login if password not match user cant not access
        if (!bcryptjs.compareSync(password, user.password)) {
            return null;
        }
        return user;
    } else {
        return null;
    }
}
