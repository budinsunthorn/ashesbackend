import { Context } from '../context'
import * as dispensaryModel from '../models/dispensary'
import { UserResolvers } from '../generated/graphql'

export const User = {
    dispensary: (_parent, args, context) => {
        return dispensaryModel.getDispensaryById(context, _parent.dispensaryId)
    },
    // users: (_parent, args, context) => {
    //     return userModel.getOrganizationById(context, _parent.id)
    // },
} satisfies UserResolvers