import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const organizationData: Prisma.OrganizationCreateInput[] = [
  {
    name: 'ashespos',
    phone: '4052130066',
  }
]


// const userData: Prisma.UserCreateInput[] = [
//   {
//     email: 'budinsunthorn@gmail.com',
//     name:'Budin',
//   }
// ]

async function main() {
  console.log(`Start seeding ...`)
  const organization = await prisma.organization.create({
    include: {
      dispensaries: {
        include: {
          users: true,
        }
      }
    },
    data: {
      name: 'ashespos-team',
      phone: '4059168804',
      dispensaries: {
          create: {
            name: 'ashespos-team',
            cannabisLicense: 'ashespos',
            cannabisLicenseExpireDate: '2000-01-01',
            businessLicense: 'ashespos',
            phone: '4059168804',
            email: 'bakerdesignlabs@gmail.com',
            locationAddress: 'ashespos',
            locationCity: 'ashespos',
            locationZipCode: '00000',
            createdAt: new Date('05 October 2011 14:48 UTC'),
            updatedAt: new Date('05 October 2011 14:48 UTC'),
            dispensaryType: 'MED',
            metrcApiKey: 'ashespos',
            metrcConnectionStatus: true,
            metrcLicenseNumber: 'ashespos',
            locationState: 'OK',
            isActive: true,
            users: {
              create:[
                {
                  email: 'bakerdesignlabs@gmail.com',
                  name: 'Ashlie',
                  createdAt: new Date('05 October 2011 14:48 UTC'),
                  updatedAt: new Date('05 October 2011 14:48 UTC'),
                  userType: 'SUPER_ADMIN_MANAGER_USER',
                  isActive: true,
                  isDispensaryAdmin: true,
                  isEmailVerified: true,
                  isOrganizationAdmin: true,
                  phone: '4052130066',
                  password: 'bakerdesignlabs',
                }
              ]
            }
          },
      }
    }
  })
  console.log(`Created organization with id: ${organization.id}`)
  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
