import { ApolloServer, BaseContext } from '@apollo/server'
import hapiApollo from "@as-integrations/hapi"
import { Server } from '@hapi/hapi'
import resolvers from './resolvers/index'
import cron from 'node-cron'
import { context } from './context'
import { readFileSync } from 'fs';
import { DateTime } from 'graphql-scalars/typings/mocks'
const Jwt = require('@hapi/jwt');
import { GraphQLError } from 'graphql';
import dotenv from "dotenv";
import { Mutation } from './resolvers/mutation'
import { UserType } from '@prisma/client'
dotenv.config()
var jwt = require('jsonwebtoken');
const typeDefs = readFileSync('./schema.graphql', { encoding: 'utf-8' });

export const throwUnauthorizedError = () => {
  throw new GraphQLError('', {
    extensions: {
      code: 401,
    },
  });
}

export const throwManualError = (code: number, manualMsg: string) => {
  throw new GraphQLError('', {
    extensions: {
      code: code,
      msg: manualMsg
    },
  });
}

const verifyToken = (artifact, secret, options = {}) => {

  try {
    Jwt.token.verify(artifact, secret, options);
    return { isValid: true };
  }
  catch (err: any) {
    return {
      isValid: false,
      error: err.message
    };
  }
};

async function StartServer() {
  const apollo = new ApolloServer<BaseContext>({
    typeDefs,
    resolvers,
    formatError: (formattedError, error) => {

      const code = formattedError.extensions?.code
      const msg = formattedError.extensions?.msg

      switch (code) {
        case 401:
          return {
            ...formattedError,
            message: 'You are not authorized to perform this action.',
          }
        case 406:
          return {
            ...formattedError,
            message: '' + msg,
          };
        case 409:
          return {
            ...formattedError,
            message: '' + msg,
          };
        case 400:
          return {
            ...formattedError,
            message: '' + msg,
          };
        default:
          return {
            ...formattedError,
            message: 'Your request has been denied.',
          };
      }
    },
  })

  await apollo.start()

  const app = new Server({
    port: 4000,
  })

  await app.route({
    method: 'POST',
    path: '/api/signin',
    handler: async (request, h) => {
      const email = request.payload["email"] || '';
      const password = request.payload["password"] || '';
      const storeLinkName = request.payload["storeLinkName"] || '';
      // console.log(request.payload)
      const userInfo = await context.prisma.user.findMany({
        where: {
          dispensary: {
            storeLinkName: storeLinkName
          },
          email: email,
          password: password
        },
        include: {
          dispensary: true
        }
      });
      // console.log("userInfo>>>>> ", userInfo)
      let token = ''
      let userData: any;

      if (userInfo.length > 0) {
        const dispensaryInfo: any = await context.prisma.dispensary.findUnique({
          include: {
            organization: true
          },
          where: {
            id: userInfo[0].dispensaryId,
          }
        });

        token = Jwt.token.generate(
          {
            userId: userInfo[0].id,
            email: userInfo[0].email,
            name: userInfo[0].name,
            storeName: dispensaryInfo.name,
            storeLinkName: dispensaryInfo.storeLinkName,
            orgName: dispensaryInfo.organization.name,
            orgLinkName: dispensaryInfo.organization.orgLinkName,
            userType: userInfo[0].userType,
            dispensaryId: userInfo[0].dispensaryId,
            organizationId: dispensaryInfo?.organizationId,
            cannabisLicense: '',
            metrcApiKey: '',
            isActive: userInfo[0].isActive,
            isDispensaryAdmin: userInfo[0].isDispensaryAdmin,
            isEmailVerified: userInfo[0].isEmailVerified,
            isOrganizationAdmin: userInfo[0].isOrganizationAdmin,
            locationState: dispensaryInfo?.locationState,
            isCustomerAgeVerify: dispensaryInfo?.isCustomerAgeVerify,
            storeTimeZone: dispensaryInfo?.storeTimeZone,
          },
          process.env.JWTSECRET,
          {
            ttlSec: 24 * 3600
          }
        );
      } else {
        token = 'none'
      }
      userData = {
        token: token,
      }
      return userData
    },
    options: {
      cors: {
        origin: ['*']  // Set the origin to allow all (*)
      }
    }
  });

  await app.route({
    method: 'GET',
    path: '/api/store',
    handler: async (request, h) => {
      const orgLinkName = request.query["orgLinkName"];
      const storeLinkName = request.query["storeLinkName"];

      if (!orgLinkName) {
        return h.response({ error: 'orgLinkName is required' }).code(400);
      }

      if (!storeLinkName) {
        return h.response({ error: 'storeLinkName is required' }).code(400);
      }

      try {
        const orgInfo = await context.prisma.organization.findUnique({
          where: {
            orgLinkName: orgLinkName.replace(/\s+/g, '').toLowerCase(),
          }
        });

        const storeInfo = await context.prisma.dispensary.findUnique({
          where: {
            storeLinkName: storeLinkName.replace(/\s+/g, '').toLowerCase(),
          }
        });

        return {
          store: storeInfo?.storeLinkName ? storeInfo?.storeLinkName : null,
          org: orgInfo?.orgLinkName ? orgInfo?.orgLinkName : null,
        };
      } catch (error) {
        console.error(error);
        return h.response({ error: 'Internal Server Error' }).code(500);
      }
    },
    options: {
      cors: {
        origin: ['*']  // Allow all origins  
      }
    }
  });

  await app.route({
    method: 'GET',
    path: '/api/storelist',
    handler: async (request, h) => {
      const orgLinkName = request.query["orgLinkName"];

      if (!orgLinkName) {
        return h.response({ error: 'orgLinkName is required' }).code(400);
      }

      try {
        const storelist = await context.prisma.dispensary.findMany({
          select: {
            name: true,
            storeLinkName: true
          },
          where: {
            organization: {
              orgLinkName: orgLinkName.replace(/\s+/g, '').toLowerCase()
            }
          },
          orderBy: {
            storeLinkName: 'asc'
          }
        });

        return storelist
      } catch (error) {
        console.error(error);
        return h.response({ error: 'Internal Server Error' }).code(500);
      }
    },
    options: {
      cors: {
        origin: ['*']  // Allow all origins  
      }
    }
  });

  // Register the middleware using server.ext before registering the plugin
  app.ext('onRequest', (request, h) => {
    return h.continue;
  });

  await app.register({
    plugin: hapiApollo,
    options: {
      path: '/ashpos',
      context: async ({ request, h }) => {
        let verified = 0;
        let role = 'GUEST'
        let userInfo = {}
        if (request.headers.authorization) {
          const [bearer, token] = request.headers.authorization.split(' ');
          jwt.verify(token, process.env.JWTSECRET, function (err, decoded) {
            if (decoded === undefined) {
              verified = 0;
            } else {
              verified = 1;
              role = decoded.userType
              userInfo = decoded
            }
          });
        }
        return {
          prisma: context.prisma,
          h: h,
          request: request,
          verified: verified,
          role: role,
          userInfo: userInfo
        };
      },
      apolloServer: apollo,
    }
  });
  await app.start()
}

async function syncMetrcForAllStores() {
  const dispensaries = await context.prisma.dispensary.findMany({
    where: {
      metrcConnectionStatus: true,
      metrcApiKey: { not: null },
    }
  })
  // console.log("dispensaries>>>", dispensaries)
  const adminUsers = await context.prisma.user.findMany({
    where: {
      userType: UserType.SUPER_ADMIN_MANAGER_USER
    }
  })
  if (adminUsers.length == 0) return

  const contextParam = {
    prisma: context.prisma,
    role: adminUsers[0].userType,
  }
  for (let i = 0; i < dispensaries.length; i++) {
    const args = {
      input: {
        dispensaryId: dispensaries[i].id,
        userId: adminUsers[0].id
      }
    }
    const packageSync = await Mutation.importMetrcPackage({}, args, contextParam)
    const transferSync = await Mutation.syncMetrcIncomingTransfer({}, args, contextParam)
    console.log("Store: ", dispensaries[i].name, " Synced at", new Date())
  }
}

// cron.schedule('*/30 * * * * *', () => {
//   syncMetrcForAllStores()
// });

cron.schedule('0 * * * *', () => {
  syncMetrcForAllStores()
});

StartServer()
  .then((server) => {
    console.log(`
🚀 Server ready at: http://localhost:4000/ashpos
`)
  })
  .catch((err) => console.log(err))