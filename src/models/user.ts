import { UserType } from "@prisma/client";
import dotenv from "dotenv";
import * as emailTemplate from '../email/userRegisterEmailTemp';
import * as notificationsEmailTemp from  '../email/notificationsEmailTemp';
const { encode, decode } = require('html-entities');

dotenv.config();
const team_ashesposai_email_key = process.env.TEAM_ASHESPOSAI_EMAIL_API_KEY

export const getUserById = async (context, id) => {
    return context.prisma.user.findUnique({
        include: {
            dispensary: true,
        },
        where: {
            id: id || undefined,
            NOT: { userType: UserType.SUPER_ADMIN_MANAGER_USER },
        }
    })
}

export const checkOldpassword = async (context, userId, oldPassword) => {
    const count = await context.prisma.user.count({
        where: {
            id: userId,
            password: oldPassword
        }
    })
    return count > 0 ? true : false
}

export const sendEmailFromTeamForUserRegister = async (user:any) => {
    if(!user.email || user.email === '') return 'failed'
    console.log("run sendEmailFromTeamForUserRegister")
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(team_ashesposai_email_key)
    const htmlString = await emailTemplate.userRegisterEmailTemp(user)
    const cleanString = htmlString.replace(/\n/g, '').replace(/\s{2,}/g, ' ');  
    const msg = {
        to: user.email, // Change to your recipient
        from: 'Team@ashespos.ai', // Change to your verified sender
        subject: 'New User Registration',
        text: cleanString,
        html: cleanString,
    }
    // console.log(team_ashesposai_email_key, msg)
    const result = await sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
        })
        .catch((error) => {
            console.error(error)
        })
    // console.log("result>>>> ", result)
    return 'success'
}

export const sendEmailFromTeamForNotification = async (notifyList:any, user: any) => {
    if(!user.email || user.email === '') return 'failed'
    console.log("run sendEmailFromTeamForNotification >>> ", notifyList, user)
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(team_ashesposai_email_key)
    const htmlString = await notificationsEmailTemp.notificationsEmailTemp(notifyList)
    const cleanString = htmlString.replace(/\n/g, '').replace(/\s{2,}/g, ' ');  
    const msg = {
        to: user.email, // Change to your recipient
        from: 'Team@ashespos.ai', // Change to your verified sender
        subject: 'Notifications for ' + user.storeName,
        text: cleanString,
        html: cleanString,
    }
    // console.log(team_ashesposai_email_key, msg)
    const result = await sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
        })
        .catch((error) => {
            console.error(error)
        })
    // console.log("result>>>> ", result)
    return 'success'
}

export const getAllUsersByDispensaryId = async (context, dispensaryId) => {
    if (dispensaryId === 'all') {
        return context.prisma.user.findMany({
            include: {
                dispensary: true,
            },
            where: {
                NOT: {
                    userType: UserType.SUPER_ADMIN_MANAGER_USER
                },
            },
            orderBy: { id: 'asc' },
        })
    } else {
        return context.prisma.user.findMany({
            include: {
                dispensary: true,
            },
            where: {
                dispensaryId: dispensaryId || undefined,
                NOT: {
                    userType: UserType.SUPER_ADMIN_MANAGER_USER
                },
            },
            orderBy: { id: 'asc' },
        })
    }
}

export const getAdmins = async (context) => {
    return context.prisma.user.findMany({
        where: { userType: UserType.SUPER_ADMIN_MANAGER_USER },
        orderBy: { id: 'asc' },
    })
}