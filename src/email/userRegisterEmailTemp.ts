const { encode, decode } = require('html-entities');

export const userRegisterEmailTemp = async (user:any) => {
    const htmlString = `
            <style>  
                body {  
                    font-family: Arial, sans-serif;  
                    background-color: #f4f4f4;  
                    margin: 0;  
                    padding: 0;  
                }  
                .container {  
                    max-width: 600px;  
                    margin: 20px auto;  
                    background-color: #ffffff;  
                    padding: 20px;  
                    border-radius: 8px;  
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);  
                }  
                .header {  
                    text-align: center;  
                    padding: 10px 0;  
                    background-color: #007BFF;  
                    color: white;  
                    border-radius: 8px 8px 0 0;  
                }  
                .content {  
                    margin: 20px 0;  
                }  
                .footer {  
                    text-align: center;  
                    font-size: 12px;  
                    color: #999;  
                    border-top: 1px solid #e9ecef;  
                    padding-top: 10px;  
                }  
                a {  
                    color: #007BFF;  
                    text-decoration: none;  
                }  
            </style>  
            <div class="container">  
                <div class="header">  
                    <h1>Welcome!</h1>  
                </div>  
                <div class="content">  
                    <h2>Thank you for registering!</h2>  
                    <p>Hi `+ user.name +`,</p>  
                    <p>We are excited to inform you that your registration was successful!</p>  
                    <p>Your account email is ` + user.email + ` and password is `+ user.password + `</p>  
                    <p>You can now log in to your account and explore all the features we offer. Please access to <a href="https://ashespos.ai">AshesPOS</a></p>  
                    <p>If you have any questions, feel free to <a href="mailto:support@ashespos.ai">contact our support team</a>.</p>  
                    <p>Best regards,<br>The AshesPOS Team</p>  
                </div>  
                <div class="footer">  
                    <p>&copy; 2025 AshesPOS. All rights reserved.</p>  
                </div>  
            </div>  
    `
    return htmlString
}