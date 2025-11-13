import { detectRuntime } from "@prisma/client/runtime/library"
import { throwUnauthorizedError, throwManualError } from '../index'
import { StateType } from "@prisma/client"

export const getLastSyncHistoryByDispensaryId = async (context, args) => {
    const syncHistories = await context.prisma.syncHistory.findMany({
        where: { 
            dispensaryId: args.dispensaryId, 
            syncType: args.syncType, 
            // isSuccess: true,
        },
        include: {
            dispensary: true,
            user: true
        },
        orderBy: { createdAt: "desc" },
    })
    return syncHistories[0]
}