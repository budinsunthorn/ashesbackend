import { NotifyType } from "../generated/graphql";

const { encode, decode } = require('html-entities');

export const notificationsEmailTemp = async (notifyList: any) => {
    let htmlString = `
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
                `;
    for (let i = 0; i < notifyList.length; i++) {
        htmlString += notifyList[i].notifyType == NotifyType.OrderSync ? `There are ${notifyList[i].count} unsynced orders. Please go to Orders page then check unsynced orders.` : ``
        htmlString += notifyList[i].notifyType == NotifyType.PackageFinish ? `${notifyList[i].count} packages are needed to be finished. Please go to Finish Packages page.` : ``
        htmlString += notifyList[i].notifyType == NotifyType.PackageReconcile ? `${notifyList[i].count} packages are needed to be reconciled. Please go to Metrc Reconciliation page.` : ``
    }

    htmlString += `<p>If you have any questions, feel free to <a href="mailto:support@ashespos.ai">contact our support team</a>.</p>  
                    <p>Best regards,<br>The AshesPOS Team</p></div>  
                <div class="footer">  
                    <p>&copy; 2025 AshesPOS. All rights reserved.</p>  
                </div>  
            </div>  
    `
    return htmlString
}