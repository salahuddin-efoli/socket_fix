
import nodemailer from "nodemailer";
/**
 * This is HTML page and made by palin html and css
 * @param  mailData The mailData is the  dynamic data those data want to see in  the mail.This mailData accept object data which format is like {name: 'a', email:
 * @returns It returns html page  with css for more attractive email
 */
function mailBody({mailData}) {
    const name = mailData &&  mailData?.name;
    const body = mailData &&  mailData?.body;
    const html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Template</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    margin: 50px auto;
                    background-color: #fff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                }
                h1 {
                    text-align: center;
                    color: #333;
                }
                .content {
                    margin-bottom: 15px;
                }
                .footer {
                    text-align: center;
                    color: #777;
                    font-size: 12px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                      <p>Dear <strong> ${name} </strong>,</p>
                      ${body}
                      <p>Best regards,</p>
                      <p>DiscountRay</p>
                      <p>Efoli.LLC</p>
                </div>
                <div class="footer">
                      <p>&copy; 2024 Our Service. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>`;
  return html;
}
/**
 * Method  to send email
 * @param to  The email you want to send  mail
 * @param subject The subject for the mail
 * @param mailData The mailData is the  dynamic data those data want to see in  the mail.This mailData accept object data which format is like {name: 'a', email: 'abc.com'}
 */
export default function sendMail({toMail=null, subject=null, mailData=""}){
    if(import.meta.env.VITE_ALLOW_SEND_MAIL != "YES"){
      return {
          success: true,
          message: "Email send not allowed",
      }
    }
    if(toMail && subject){
        const transporter = nodemailer.createTransport({
            host: import.meta.env.VITE_MAIL_HOST,
            port: import.meta.env.VITE_MAIL_PORT,
            secure: import.meta.env.VITE_MAIL_PORT == 465 ? true : false, // true for 465, false for other por
            auth: {
              user: import.meta.env.VITE_MAIL_USER,
              pass: import.meta.env.VITE_MAIL_PASSWORD,
            },
        });
        const mailOptions = {
            from: import.meta.env.VITE_MAIL_USER,
            to: toMail,
            subject: subject,
            html: mailBody({mailData: mailData})
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                return {
                    success: false,
                    message: "Email not send",
                }
            } else {
                return {
                    success: true,
                    message: "Email has been successfully send",
                }
            }
        })
    }else{
      return {
          success: false,
          message: "email or subject not found",
      }
    }
}