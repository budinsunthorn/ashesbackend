import { Context } from '../context'
import * as userModel from '../models/user'
import * as dispensaryModel from '../models/dispensary'
import * as organizationModel from '../models/organization'
import { OrganizationResolvers } from '../generated/graphql'
import { GraphQLError } from 'graphql';
export const Organization = {
    dispensaries: (_parent, args, context) => {
        if(context.role.includes('ADMIN_MANAGER_USER')) return dispensaryModel.getDispensairesByOrganizationId(context, _parent.id)
        else  return null
    },
} satisfies OrganizationResolvers