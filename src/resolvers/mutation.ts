import { UserType, DrawerStatus, PackageStatus, OrderStatus, OrderType, TaxSettingApplyTo, DiscountMethod, CustomerStatus, SyncType, LoyaltyTxType, OrderMjType, SupplierType, ProductUnitOfMeasure, ActionNameList } from "@prisma/client";
import { LimitWeight, MutationResolvers, PurchaseLimitType } from '../generated/graphql'
import { PrismaClient, Prisma } from '@prisma/client'
import { GraphQLError, UniqueDirectivesPerLocationRule } from 'graphql';
import { throwUnauthorizedError, throwManualError } from '../index'
import { truncateToTwoDecimals, setFourDecimals, getConvertedWeight } from "../context";
import { endPoints } from "../context";
const { format } = require('date-fns');

var chunk = require('chunk')
import * as metrcModel from '../models/metrc'
import * as supplierModel from '../models/supplier'
import * as taxSetting from '../models/taxSetting'
import * as discountModel from '../models/discount'
import * as loyaltyModel from '../models/loyalty'
import * as userModel from '../models/user'
import * as orderitemModel from '../models/orderItem'
const crypto = require('crypto');
const fs = require('fs');
const csv = require('csv-parser');
const { Transform } = require('stream');
// Create a transform stream that removes double quotes from each string value
const removeQuotesFromName = new Transform({
    objectMode: true,
    transform(record, encoding, callback) {
        if (record.Name) {
            // Remove all double quotes from the Name field
            record.Name = record.Name.replace(/"/g, '');
        }
        callback(null, record);
    }
});

const generateHash = (str) => {
    return crypto.createHash('md5').update(str).digest('hex');
}

const duplicate_array = {
    ['name']: 'Name',
    ['phone']: 'Phone Number',
    ['email']: 'Email',
    ['cannabisLicense']: 'Cannabis License',
    ['metrcApiKey']: 'Metrc API Key',
    ['driverLicense']: 'Driver License',
    ['medicalLicense']: 'Medical License',
    ['businessLicense']: 'Business License',
    ['sku']: 'SKU',
    ['upc']: 'UPC',
    ['organizationId']: 'object in one organization',
    ['dispensaryId']: 'object in one dispensary',
    ['stateOfUsa']: 'object in one state',
    ['applyTarget']: 'discount',
}

export const handlePrismaError = (e) => {
    let field = ''
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
        console.log(e)
        switch (e.code) {
            case 'P2002':
                if (e.meta?.target) field = e.meta.target[0]
                throw new GraphQLError('duplicate', {
                    extensions: {
                        code: 409,
                        msg: 'Duplicated ' + duplicate_array[field]
                        // msg: 'Duplicated Value'
                    },
                });
            case 'P2003':
                if (e.meta?.target) field = e.meta.target[0]
                throw new GraphQLError('hasChildren', {
                    extensions: {
                        code: 406,
                        msg: 'Can not be processed.'
                    },
                });
            default:
                throw new GraphQLError('hasChildren', {
                    extensions: {
                        code: 500,
                        msg: 'Your request has been denied.'
                    },
                });
        }
    }
}

export const Mutation = {
    createOrganization: async (_parent, _args, context) => {

        if (context.role.includes(UserType.SUPER_ADMIN_MANAGER_USER)) {
            try {
                const creationData: any = _args.input
                creationData.orgLinkName = _args.input.name.replace(/\s+/g, '').toLowerCase()
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.organization.create({
                        data: creationData
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createOrganization,
                            targetRecordId: creation.id,
                            f1: creation.name
                        }
                    })

                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createDispensary: async (_parent, _args, context) => {
        if (context.role.includes(UserType.ADMIN_MANAGER_USER)) {
            try {
                const creationData: any = _args.input
                creationData.storeLinkName = _args.input.name.replace(/\s+/g, '').toLowerCase()

                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.dispensary.create({
                        data: creationData
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createDispensary,
                            targetRecordId: creation.id,
                            f1: creation.name
                        }
                    })

                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createSupplier: async (_parent, _args, context) => {
        if (context.role.includes(UserType.ADMIN_MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {

                    const creation = await tx.supplier.create({
                        data: _args.input
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createSupplier,
                            targetRecordId: creation.id,
                            f1: creation.name,
                            f2: creation.businessLicense,
                        }
                    })
                    return creation;
                })

            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createMoneyDrop: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {

                    const creation = await tx.moneyDrop.create({
                        data: _args.input
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createMoneyDrop,
                            targetRecordId: creation.id,
                            f1: creation.dropType,
                            f2: creation.amount.toString(),
                            f3: creation.reason,
                        }
                    })
                    return creation;
                })

            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createUser: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.user.create({
                        data: _args.input
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createUser,
                            targetRecordId: creation.id,
                            f1: creation.name,
                        }
                    })

                    const sendEmail = await userModel.sendEmailFromTeamForUserRegister(creation)
                    return creation
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        } else return throwUnauthorizedError()
    },
    createAdmin: async (_parent, _args, context) => {
        if (context.role.includes(UserType.SUPER_ADMIN_MANAGER_USER)) {
            try {
                const creation = await context.prisma.user.create({
                    data: _args.input
                });
                return creation
            } catch (e) {
                handlePrismaError(e)
            }
        } else return throwUnauthorizedError()
    },
    createCustomer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.customer.create({
                        data: {
                            dispensaryId: _args.input.dispensaryId,
                            name: _args.input.name.toUpperCase(),
                            MFType: _args.input.MFType,
                            birthday: new Date(_args.input.birthday).toLocaleDateString('en-US'),
                            email: _args.input.email,
                            phone: _args.input.phone,
                            isActive: _args.input.isActive,
                            driverLicense: _args.input.driverLicense.toUpperCase(),
                            driverLicenseExpirationDate: new Date(_args.input.driverLicenseExpirationDate).toLocaleDateString('en-US'),
                            isMedical: _args.input.isMedical,
                            medicalLicense: _args.input.medicalLicense.toUpperCase(),
                            medicalLicenseExpirationDate: new Date(_args.input.medicalLicenseExpirationDate).toLocaleDateString('en-US'),
                            loyaltyPoints: _args.input.loyaltyPoints,
                            status: _args.input.status,
                            isTaxExempt: _args.input.isTaxExempt,
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createCustomer,
                            targetRecordId: creation.id,
                            f1: creation.name,
                            f2: creation.medicalLicense,
                            customerId: creation.id
                        }
                    })
                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
                console.log(e)
            }
        }
        else return throwUnauthorizedError()
    },
    startDrawer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const drawerCount = await context.prisma.drawer.count({
                where: {
                    dispensaryId: _args.input.dispensaryId,
                    register: _args.input.register,
                    status: DrawerStatus.PENDING
                },
            })
            if (drawerCount > 0) return throwManualError(400, 'Can not start duplicate register.')

            try {
                return context.prisma.$transaction(async (tx) => {
                    const preUpdating = await tx.drawer.updateMany({
                        where: {
                            dispensaryId: _args.input.dispensaryId,
                            register: {
                                not: _args.input.register,
                            },
                            userId: _args.input.userId
                        },
                        data: {
                            isUsing: false,
                        },
                    });
                    const creation = await tx.drawer.create({
                        data: _args.input
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.startDrawer,
                            targetRecordId: creation.id,
                            f1: creation.startAmount.toString(),
                            f2: creation.register,
                        }
                    })
                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createProduct: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.product.create({
                        data: {
                            dispensaryId: _args.input.dispensaryId,
                            userId: _args.input.userId,
                            supplierId: _args.input.supplierId,
                            itemCategoryId: _args.input.itemCategoryId,
                            name: _args.input.name,
                            sku: _args.input.sku,
                            upc: _args.input.upc,
                            price: truncateToTwoDecimals(_args.input.price),
                            productUnitOfMeasure: _args.input.productUnitOfMeasure,
                            unitOfUnitWeight: _args.input.unitOfUnitWeight,
                            unitOfNetWeight: _args.input.unitOfNetWeight,
                            unitWeight: _args.input.unitWeight,
                            isApplyUnitWeight: _args.input.isApplyUnitWeight,
                            netWeight: _args.input.netWeight,
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createProduct,
                            targetRecordId: creation.id,
                            f1: creation.name,
                            productId: creation.id
                        }
                    })
                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createLoyalty: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.loyalty.create({
                        data: _args.input
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createLoyalty,
                            targetRecordId: creation.id,
                            f1: creation.name,
                        }
                    })
                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createDiscount: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.discount.create({
                        data: _args.input
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createDiscount,
                            targetRecordId: creation.id,
                            f1: creation.name,
                        }
                    })
                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createItemCategory: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.itemCategory.create({
                        data: _args.input
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createItemCategory,
                            targetRecordId: creation.id,
                            f1: creation.name,
                        }
                    })
                    return creation;
                })

            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    setPurchaseLimitByDispensaryId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    let dispensaryId: any = ''
                    if (_args.input) dispensaryId = _args.input[0]?.dispensaryId
                    const deletion = await tx.purchaseLimit.deleteMany({
                        where: {
                            dispensaryId: dispensaryId
                        }
                    })
                    const creation = await tx.purchaseLimit.createMany({
                        data: _args.input
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.setPurchaseLimitByDispensaryId,
                        }
                    })
                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createTaxSetting: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {

                    const creation = await tx.taxSetting.create({
                        data: _args.input
                    });

                    const updateMjTaxApply = await taxSetting.updateTaxApply(context, _args.input.dispensaryId, TaxSettingApplyTo.MJ)
                    const updateNmjTaxApply = await taxSetting.updateTaxApply(context, _args.input.dispensaryId, TaxSettingApplyTo.NMJ)

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createTaxSetting,
                            f1: creation.name,
                        }
                    })
                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const getDrawer = await context.prisma.drawer.findMany({
                where: {
                    dispensaryId: _args.input.dispensaryId,
                    userId: _args.input.userId,
                    isUsing: true,
                },
            })
            if (getDrawer.length === 0) return throwManualError(400, 'Please start Drawer.')
            const drawerId = getDrawer[0].id
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.order.create({
                        data: {
                            dispensaryId: _args.input.dispensaryId,
                            userId: _args.input.userId,
                            status: _args.input.status,
                            orderDate: _args.input.orderDate,
                            drawerId: drawerId,
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createOrder,
                            orderId: creation.id,
                        }
                    })
                    return creation;
                })

            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createNonMJPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.package.create({
                        data: {
                            dispensaryId: _args.input.dispensaryId,
                            nonMjTransferId: _args.input.transferId,
                            packageStatus: PackageStatus.PENDING,
                        }
                    });
                    const update = await tx.package.update({
                        where: {
                            id: creation.id
                        },
                        data: {
                            packageLabel: creation.id
                        }
                    })

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createNonMJPackage,
                            packageLabel: creation.id,
                        }
                    })
                    return creation;
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    holdPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const update = await tx.package.update({
                        where: {
                            id: _args.input.id
                        },
                        data: {
                            packageStatus: PackageStatus.HOLD
                        }
                    })

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.holdPackage,
                            packageLabel: update.packageLabel,
                        }
                    })
                    return update;
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    unHoldPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const update = await tx.package.update({
                        where: {
                            id: _args.input.id
                        },
                        data: {
                            packageStatus: PackageStatus.ACTIVE
                        }
                    })

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.unHoldPackage,
                            packageLabel: update.packageLabel,
                        }
                    })
                    return update;
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    fetchTestResultsByPackageId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let creation: any
                const fetchTestResult = await metrcModel.fetchTestResultByPackageId(context, _args.input?.dispensaryId, _args.input?.packageId)

                creation = await context.prisma.testResult.createMany({
                    data: fetchTestResult,
                    skipDuplicates: true
                })
                console.log('Test Result data imported for packageId : ', _args.input?.packageId, creation.count, 'records');
                return creation;
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    activePackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const currentPackage = await tx.package.findUnique({
                        where: {
                            id: _args.input.id
                        },
                        include: {
                            assignPackage: true
                        }
                    })
                    if (currentPackage.packageStatus != PackageStatus.FINISHED) return throwManualError(400, "Only Finished packages can be reactivated.")
                    const paramData = [
                        {
                            Label: currentPackage.packageLabel,
                        }
                    ]

                    const syncMetrc = await metrcModel.unFinishMetrcPackage(context, currentPackage.dispensaryId, paramData)
                    if (syncMetrc != 200) return throwManualError(400, "Error syncing with Metrc.")

                    const update = await tx.package.update({
                        where: {
                            id: _args.input.id
                        },
                        data: {
                            packageStatus: PackageStatus.ACTIVE
                        }
                    })

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.activePackage,
                            packageLabel: update.packageLabel,
                        }
                    })
                    return update;
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    finishPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const currentPackage = await tx.package.findUnique({
                        where: {
                            id: _args.input.id
                        },
                        include: {
                            assignPackage: true
                        }
                    })

                    if (currentPackage.packageStatus != PackageStatus.ACTIVE) return throwManualError(400, "Only Active packages can be finished.")
                    if (currentPackage.assignPackage.posQty > 0) return throwManualError(400, "To finish, package inventory must be zero.")

                    const paramData = [
                        {
                            Label: currentPackage.packageLabel,
                            ActualDate: new Date().toISOString().slice(0, 10)
                        }
                    ]
                    console.log("paramData>> ", paramData)
                    if (currentPackage.packageId > 0) {
                        const syncMetrc = await metrcModel.finishMetrcPackage(context, currentPackage.dispensaryId, paramData)
                        if (syncMetrc != 200) return throwManualError(400, "Metrc Sync Failed.")
                        const update = await tx.package.update({
                            where: {
                                id: _args.input.id
                            },
                            data: {
                                packageStatus: PackageStatus.FINISHED
                            }
                        })
                        const actionHistory = await tx.actionHistory.create({
                            data: {
                                dispensaryId: context.userInfo.dispensaryId,
                                userId: context.userInfo.userId,
                                userName: context.userInfo.name,
                                actionName: ActionNameList.finishPackage,
                                packageLabel: update.packageLabel,
                            }
                        })
                        return update;
                    } else {
                        const update = await tx.package.update({
                            where: {
                                id: _args.input.id
                            },
                            data: {
                                packageStatus: PackageStatus.FINISHED
                            }
                        })
                        const actionHistory = await tx.actionHistory.create({
                            data: {
                                dispensaryId: context.userInfo.dispensaryId,
                                userId: context.userInfo.userId,
                                userName: context.userInfo.name,
                                actionName: ActionNameList.finishPackage,
                                packageLabel: update.packageLabel,
                            }
                        })
                    }
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    finishZeroPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const packages = await tx.package.findMany({
                        where: {
                            dispensaryId: _args.dispensaryId,
                            Quantity: 0,
                            packageStatus: PackageStatus.ACTIVE,
                            assignPackage: {
                                posQty: 0
                            },
                        },
                        select: {
                            packageLabel: true,
                            packageId: true
                        }
                    })

                    // console.log("zero packages>>>> ", packages)
                    const paramData = packages.filter(item => item.packageId > 0).map(item => ({
                        Label: item.packageLabel,
                        ActualDate: new Date().toISOString().slice(0, 10) // today's date in YYYY-MM-DD
                    }));
                    const labels = paramData.map(item => item.Label);
                    const syncMetrc = await metrcModel.finishMetrcPackage(context, _args.dispensaryId, paramData)
                    if (syncMetrc != 200) return throwManualError(400, "Error syncing with Metrc.")

                    const update = await tx.package.updateMany({
                        where: {
                            dispensaryId: _args.dispensaryId,
                            Quantity: 0,
                            packageStatus: PackageStatus.ACTIVE,
                            assignPackage: {
                                posQty: 0
                            },
                        },
                        data: {
                            packageStatus: PackageStatus.FINISHED,
                        }
                    })

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.finishZeroPackage,
                            f1: update.count.toString(),
                            f2: labels.toString(),
                        }
                    })

                    for (let i = 0; i < labels.length; i++) {
                        const actionHistory = await tx.actionHistory.create({
                            data: {
                                dispensaryId: context.userInfo.dispensaryId,
                                userId: context.userInfo.userId,
                                userName: context.userInfo.name,
                                actionName: ActionNameList.finishPackage,
                                packageLabel: labels[i],
                            }
                        })
                    }
                    return update;
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createTransfer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let inputData: any = _args.input
                inputData.ReceivedDateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS', { timeZone: 'UTC' });
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.transfer.create({
                        data: _args.input
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createTransfer,
                            targetRecordId: creation.id,
                        }
                    })
                    return creation;
                })

            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createPrintSetting: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const upsertSetting = await tx.printSetting.upsert({
                        where: {
                            dispensaryId_printType: {
                                dispensaryId: _args.input.dispensaryId,
                                printType: _args.input.printType,
                            }
                        },
                        update: {
                            isEnabled: _args.input.isEnabled,
                            marginBottom: _args.input.marginBottom,
                            marginLeft: _args.input.marginLeft,
                            marginRight: _args.input.marginRight,
                            marginTop: _args.input.marginTop,
                            dimensionHeight: _args.input.dimensionHeight,
                            dimensionWidth: _args.input.dimensionWidth,
                            topText: _args.input.topText,
                            bottomText: _args.input.bottomText,
                            fontSize: _args.input.fontSize,
                        },
                        create: {
                            dispensaryId: _args.input.dispensaryId,
                            isEnabled: _args.input.isEnabled,
                            marginBottom: _args.input.marginBottom,
                            marginLeft: _args.input.marginLeft,
                            marginRight: _args.input.marginRight,
                            marginTop: _args.input.marginTop,
                            dimensionHeight: _args.input.dimensionHeight,
                            dimensionWidth: _args.input.dimensionWidth,
                            topText: _args.input.topText,
                            bottomText: _args.input.bottomText,
                            fontSize: _args.input.fontSize,
                            printType: _args.input.printType,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createPrintSetting,
                            targetRecordId: upsertSetting.id,
                        }
                    })
                    return upsertSetting;
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createCustomerQueue: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.customerQueue.create({
                        data: _args.input
                    });
                    const customer = await tx.customer.findUnique({
                        where: {
                            id: _args.input.customerId
                        }
                    })
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createCustomerQueue,
                            customerId: _args.input.customerId,
                            f1: customer.name,
                            f2: customer.medicalLicense
                        }
                    })
                    return creation;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createOrderItem: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            // Check if RETURN or not
            const order = await context.prisma.order.findUnique({
                where: { id: _args.input.orderId || undefined },
                include: {
                    OrderItem: {
                        include: {
                            product: {
                                include: {
                                    itemCategory: true,
                                },
                            },
                            package: true
                        }
                    }
                },
            })
            // console.log(order)
            if (order.orderType === OrderType.RETURN) return throwManualError(400, "The Order #" + _args.input.orderId + " is RETURN type. Can not add items.")
            // Check if RETURN or not
            const dispensaryId = order.dispensaryId
            const orderId = order.id

            const currentTypeLimitValue = await context.prisma.purchaseLimit.findMany({
                where: {
                    dispensaryId: order.dispensaryId,
                },
            })

            // Initialize empty objects
            const limitUnitMap = {};
            const limitWeightMap = {};
            const purchaseLimitAmountMap = {};

            // Loop through the array to populate objects
            currentTypeLimitValue.forEach(item => {
                limitUnitMap[item.purchaseLimitType] = item.limitUnit;
                limitWeightMap[item.purchaseLimitType] = item.limitWeight;
                purchaseLimitAmountMap[item.purchaseLimitType] = item.purchaseLimitAmount;
            });


            const product = await context.prisma.product.findUnique({
                where: { id: _args.input.productId || undefined },
                include: {
                    itemCategory: true
                }
            })
            const applyUnitWeight = product.productUnitOfMeasure == ProductUnitOfMeasure.ea && product.isApplyUnitWeight && product.unitWeight > 0 ? product.unitWeight : 1
            const productUnitWeight = product.unitWeight > 0 ? product.unitWeight : 1
            const productNetWeight = product.netWeight > 0 ? product.netWeight : 1
            if (product.itemCategory.containMj) {
                if (!product.itemCategory.purchaseLimitType) return throwManualError(400, "Please set Limit Type for " + product.itemCategory.name)
                if (currentTypeLimitValue.length > 0) {


                    const purchaseLimit = order.OrderItem.filter(item => item.mjType === OrderMjType.MJ).reduce((acc, item) => {
                        const purchaseLimitType = item.product.itemCategory.purchaseLimitType;
                        if (!acc[purchaseLimitType]) {
                            acc[purchaseLimitType] = 0;
                        }
                        const standardLimitUnit = limitUnitMap[purchaseLimitType]
                        const limitWeightType = limitWeightMap[purchaseLimitType]

                        let convertedWeight

                        if (item.product.productUnitOfMeasure == ProductUnitOfMeasure.ea) {
                            const weight = limitWeightType == LimitWeight.UnitWeight ? productUnitWeight : productNetWeight
                            const itemWeightUnit = limitWeightType == LimitWeight.UnitWeight ? item.product.unitOfUnitWeight : item.product.unitOfNetWeight
                            const qty = item.product.isApplyUnitWeight && item.product.unitWeight > 0 ? truncateToTwoDecimals(item.quantity / item.product.unitWeight * weight) : item.quantity * weight
                            convertedWeight = getConvertedWeight(qty, itemWeightUnit, standardLimitUnit)
                        } else {
                            convertedWeight = getConvertedWeight(item.quantity, ProductUnitOfMeasure.g, standardLimitUnit)
                        }

                        acc[purchaseLimitType] += convertedWeight;
                        return acc;
                    }, {});

                    const standardLimitAmount = purchaseLimitAmountMap[product.itemCategory.purchaseLimitType]
                    const standardLimitUnit = limitUnitMap[product.itemCategory.purchaseLimitType]
                    const limitWeightType = limitWeightMap[product.itemCategory.purchaseLimitType]

                    let convertedWeight
                    if (product.productUnitOfMeasure == ProductUnitOfMeasure.ea) {
                        const weight = limitWeightType == LimitWeight.UnitWeight ? productUnitWeight : productNetWeight
                        const itemWeightUnit = limitWeightType == LimitWeight.UnitWeight ? product.unitOfUnitWeight : product.unitOfNetWeight
                        const qty = _args.input.quantity * weight
                        // console.log(qty, itemWeightUnit, standardLimitUnit)
                        convertedWeight = getConvertedWeight(qty, itemWeightUnit, standardLimitUnit)
                    } else {
                        convertedWeight = getConvertedWeight(_args.input.quantity, ProductUnitOfMeasure.g, standardLimitUnit)
                    }
                    const limitAmountAfterAdded = purchaseLimit[product.itemCategory.purchaseLimitType] | 0 + convertedWeight | 0
                    // console.log("current >>>", purchaseLimit[product.itemCategory.purchaseLimitType])
                    // console.log("convertedWeight >>>", convertedWeight)
                    // console.log("standardLimitAmount >>>", standardLimitAmount)
                    // console.log("limitAmountAfterAdded >>>", limitAmountAfterAdded)
                    if (limitAmountAfterAdded > standardLimitAmount) return throwManualError(400, "Exceeded " + product.itemCategory.purchaseLimitType + " limit")
                }
            }

            const applyTo = product.itemCategory.containMj ? TaxSettingApplyTo.MJ : TaxSettingApplyTo.NMJ

            // if (order.mjType !== "NONE" && order.mjType !== applyTo) {
            //     return throwManualError(400, "MJ and non-MJ products can not be included in the same order.")
            // }

            try {
                return context.prisma.$transaction(async (tx) => {

                    // Set order type
                    if (applyTo == OrderMjType.MJ) {
                        const updateOrderMjType = await tx.order.update({
                            data: {
                                mjType: applyTo
                            },
                            where: {
                                id: orderId,
                            },
                        });
                    }

                    let baseAmount = setFourDecimals(_args.input.quantity) * setFourDecimals(_args.input.price)
                    let costAmount = setFourDecimals(_args.input.quantity) * setFourDecimals(_args.input.cost)
                    // Get Discount Info
                    const discountHistory = await tx.discountHistory.findMany({
                        where: { orderId: orderId || undefined },
                    })

                    let discountedAmount = 0
                    if (discountHistory.length > 0) {
                        discountedAmount = await discountModel.setDiscountForOrderItems(tx, orderId, discountHistory[0].discountMethod, discountHistory[0].value, setFourDecimals(baseAmount))
                    }

                    //Get Loyalty Info
                    let loyaltyAmount = 0
                    const loyaltyHistory = await tx.loyaltyHistory.findMany({
                        where: {
                            orderId: orderId || undefined,
                            txType: LoyaltyTxType.spend,
                        },
                    })
                    if (loyaltyHistory.length > 0) {
                        loyaltyAmount = await loyaltyModel.setLoyaltyForOrderItems(tx, orderId, loyaltyHistory[0].loyaltyType, loyaltyHistory[0].loyaltyWorth, loyaltyHistory[0].value, setFourDecimals(baseAmount))
                    }

                    // Create order item
                    const creation = await tx.orderItem.create({
                        data: {
                            orderId: _args.input.orderId,
                            productId: _args.input.productId,
                            packageLabel: _args.input.packageLabel,
                            quantity: setFourDecimals(setFourDecimals(_args.input.quantity) * setFourDecimals(applyUnitWeight)),
                            price: truncateToTwoDecimals(_args.input.price),
                            cost: truncateToTwoDecimals(_args.input.cost),
                            amount: setFourDecimals(baseAmount),
                            costAmount: setFourDecimals(costAmount),
                            discountedAmount: setFourDecimals(discountedAmount),
                            loyaltyAmount: setFourDecimals(loyaltyAmount),
                            mjType: applyTo
                        }
                    });
                    const orderItemId = creation.id;
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.createOrderItem,
                            orderId: _args.input.orderId,
                            packageLabel: _args.input.packageLabel,
                            productId: _args.input.productId,
                            customerId: order.customerId,
                            targetRecordId: creation.id,
                            f1: product.name,
                            f2: _args.input.packageLabel
                        }
                    })
                    return creation;
                });
            } catch (e) {
                handlePrismaError(e);
            }
        }
        else return throwUnauthorizedError()
    },
    createOrderItemForReturn: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const order = await context.prisma.order.findUnique({
                where: { id: _args.input.orderId || undefined },
            })
            const product = await context.prisma.product.findUnique({
                where: { id: _args.input.productId }
            })
            if (order.orderType === OrderType.SALE) return throwManualError(400, "The Order #" + _args.input.orderId + " is SALE type.")

            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.orderItem.create({
                        data: {
                            orderId: _args.input.orderId,
                            productId: _args.input.productId,
                            packageLabel: _args.input.packageLabel,
                            quantity: truncateToTwoDecimals(_args.input.quantity),
                            price: truncateToTwoDecimals(product.price),
                            amount: product.price * _args.input.quantity,
                        }
                    })
                    return creation;
                });
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    completeOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let posSuccess, metrcSuccess
                // const sendEmail = await userModel.sendEmailFromTeamForUserRegister({ email: 'jjhbudin@gmail.com' })
                const currentOrder = await context.prisma.order.findUnique({
                    where: {
                        id: _args.input.orderId,
                    },
                    select: {
                        mjType: true
                    }
                })
                let posUpdateResult: any

                const items = await context.prisma.orderItem.findMany({
                    where: {
                        orderId: _args.input.orderId,
                    },
                    select: {
                        productId: true,
                        quantity: true,
                        packageLabel: true
                    }
                })
                const updateStock = async (packageLabel: string, quantity: number) => {
                    try {
                        const decreaseStock = await context.prisma.assignPackage.update({
                            where: {
                                packageLabel: packageLabel,
                            },
                            data: {
                                posQty: {
                                    decrement: truncateToTwoDecimals(quantity)
                                },
                            }
                        })
                        const decreaseStockForPackage = await context.prisma.package.update({
                            where: {
                                packageLabel: packageLabel,
                            },
                            data: {
                                posQty: decreaseStock.posQty
                            }
                        })
                    } catch (err) {
                        console.log("::err", err)
                    } finally {
                        // console.log("::ended subaction")
                    }
                }
                await Promise.all(items.map((item: any) => updateStock(item.packageLabel, item.quantity)))

                const orderItemSum = await context.prisma.orderItem.aggregate({
                    _sum: {
                        amount: true,
                        discountedAmount: true,
                        loyaltyAmount: true,
                        costAmount: true,

                    },
                    where: {
                        orderId: _args.input.orderId,
                    },
                });

                const taxSum = await context.prisma.taxHistory.aggregate({
                    _sum: {
                        taxAmount: true,
                    },
                    where: {
                        orderId: _args.input.orderId,
                    },
                });



                //get applied loyalty info
                // const appliedLoyaltyInfo = await tx.loyaltyHistory.findFirst({
                //     where: {
                //         orderId: _args.input.orderId,
                //         txType: LoyaltyTxType.spend
                //     },
                // })
                const appliedLoyaltyInfo = await context.prisma.loyalty.findFirst({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                        isActive: true
                    }
                })
                const receivedAmount = _args.input.amount - _args.input.changeDue
                if (appliedLoyaltyInfo) {
                    const earnedValue = truncateToTwoDecimals(receivedAmount)
                    const createLoyaltyEarn = await context.prisma.loyaltyHistory.create({
                        data: {
                            dispensaryId: _args.input.dispensaryId,
                            txType: LoyaltyTxType.earn,
                            orderId: _args.input.orderId,
                            loyaltyName: appliedLoyaltyInfo.name,
                            loyaltyType: appliedLoyaltyInfo.type,
                            loyaltyWorth: appliedLoyaltyInfo.pointWorth,
                            value: earnedValue
                        }
                    })

                    const updateCustomerLoyalty = await context.prisma.customer.update({
                        where: {
                            id: _args.input.customerId
                        },
                        data: {
                            loyaltyPoints: {
                                increment: earnedValue
                            },
                        }
                    })
                }

                const deletionCustomerInQueue = await context.prisma.customerQueue.deleteMany({
                    where: {
                        customerId: _args.input.customerId
                    }
                })

                //important!
                //order should include metrcId 
                const updating = await context.prisma.order.update({
                    where: {
                        id: _args.input.orderId,
                    },
                    data: {
                        status: OrderStatus.PAID,
                        cashAmount: setFourDecimals(_args.input.amount),
                        otherAmount: setFourDecimals(_args.input.otherAmount),
                        changeDue: setFourDecimals(_args.input.changeDue),
                        discount: setFourDecimals(orderItemSum._sum.discountedAmount),
                        loyalty: setFourDecimals(orderItemSum._sum.loyaltyAmount),
                        cost: setFourDecimals(orderItemSum._sum.costAmount),
                        tax: setFourDecimals(taxSum._sum.taxAmount),
                    }
                });
                posUpdateResult = updating

                if (currentOrder.mjType === OrderMjType.MJ) {
                    const metrcReportResult = await metrcModel.postMetrcReceiptByOrderId(context, _args.input.dispensaryId, _args.input.orderId)
                    posSuccess = posUpdateResult?.id ? true : false
                    metrcSuccess = metrcReportResult === 200 ? 'success' : 'failed'
                } else {
                    posSuccess = posUpdateResult?.id ? true : false
                    metrcSuccess = 'ignore'
                }

                const actionHistory = await context.prisma.actionHistory.create({
                    data: {
                        dispensaryId: context.userInfo.dispensaryId,
                        userId: context.userInfo.userId,
                        userName: context.userInfo.name,
                        actionName: ActionNameList.completeOrder,
                        orderId: _args.input.orderId,
                        customerId: _args.input.customerId,
                        f1: metrcSuccess
                    }
                })

                // console.log(posUpdateResult)
                let response: any = {
                    pos: posSuccess,
                    metrc: metrcSuccess
                }

                return response

            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    setDiscountForOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.discountHistory.create({
                        data: _args.input
                    });
                    let discountedAmount = 0
                    discountedAmount = await discountModel.setDiscountForOrderItems(tx, _args.input.orderId, _args.input.discountMethod, _args.input.value, 0)

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.setDiscountForOrder,
                            orderId: _args.input.orderId,
                            f1: _args.input.discountName,
                            f2: _args.input.discountMethod,
                            f3: _args.input.value.toString(),
                        }
                    })
                    return creation
                });
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    unFinalizeMetrcOrderDataByOrderDate: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const orders = await context.prisma.order.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                        orderDate: _args.input.orderDate,
                        metrcId: {
                            gt: 0
                        }
                    }
                })
                for (let i = 0; i < orders.length; i++) {
                    const updateOrder = await metrcModel.unFinalizeOrderByMetrcId(context, _args.input.dispensaryId, orders[i].metrcId)
                    console.log(updateOrder)
                }
                return true
            } catch (e) {
                handlePrismaError(e)
                return false
            }
        }
        else return throwUnauthorizedError()
    },
    finalizeMetrcOrderDataByOrderDate: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const orders = await context.prisma.order.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                        orderDate: _args.input.orderDate,
                        metrcId: {
                            gt: 0
                        }
                    }
                })
                for (let i = 0; i < orders.length; i++) {
                    const updateOrder = await metrcModel.finalizeOrderByMetrcId(context, _args.input.dispensaryId, orders[i].metrcId)
                    console.log(updateOrder)
                }
                return true
            } catch (e) {
                handlePrismaError(e)
                return false
            }
        }
        else return throwUnauthorizedError()
    },
    updateMetrcOrderDataByOrderDate: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const orders = await context.prisma.order.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                        orderDate: _args.input.orderDate,
                        metrcId: {
                            gt: 0
                        }
                    }
                })
                for (let i = 0; i < orders.length; i++) {
                    const updateTax = await orderitemModel.updateTaxHistoryForOrder(context, orders[i].id)
                    const updateOrder = await metrcModel.putMetrcReceiptByOrderId(context, _args.input.dispensaryId, orders[i].id)
                }
                return true
            } catch (e) {
                handlePrismaError(e)
                return false
            }
        }
        else return throwUnauthorizedError()
    },
    updateNonMjOrderDataByOrderDate: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const orders = await context.prisma.order.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                        orderDate: _args.input.orderDate,
                        metrcId: null
                    }
                })
                for (let i = 0; i < orders.length; i++) {
                    const updateTax = await orderitemModel.updateTaxHistoryForOrder(context, orders[i].id)
                }
                return true
            } catch (e) {
                handlePrismaError(e)
                return false
            }
        }
        else return throwUnauthorizedError()
    },
    syncOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const order = await tx.order.findUnique({
                        where: {
                            id: _args.input.id
                        },
                        select: {
                            dispensaryId: true,
                            metrcId: true
                        }
                    })
                    const metrcId = order?.metrcId || 0
                    if (metrcId > 0) return false

                    const metrcReportResult = await metrcModel.postMetrcReceiptByOrderId(context, order.dispensaryId, _args.input.id)
                    const metrcSuccess = metrcReportResult === 200 ? true : false

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.syncOrder,
                            orderId: _args.input.id,
                            f1: metrcSuccess.toString(),
                        }
                    })

                    return metrcSuccess
                })

            } catch (e) {
                handlePrismaError(e)
                return null
            }
        }
        else return throwUnauthorizedError()
    },
    unSyncOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const order = await tx.order.findUnique({
                        where: {
                            id: _args.input.id
                        },
                        select: {
                            dispensaryId: true,
                            metrcId: true
                        }
                    })

                    const metrcId = order?.metrcId || 0
                    if (metrcId === 0) return false

                    const unSyncResult = await metrcModel.delMetrcReceipt(context, order.dispensaryId, metrcId, _args.input.id)

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.unSyncOrder,
                            orderId: _args.input.id,
                            f1: unSyncResult.toString(),
                        }
                    })

                    return unSyncResult
                })

            } catch (e) {
                handlePrismaError(e)
                return null
            }
        }
        else return throwUnauthorizedError()
    },
    setLoyaltyForOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const creation = await tx.loyaltyHistory.create({
                        data: _args.input
                    });
                    // const order = await tx.order.findUnique({
                    //     where: {
                    //         id: _args.input.orderId
                    //     }
                    // })
                    const loyaltyAmount = _args.input.loyaltyWorth * _args.input.value

                    const order = await tx.order.update({
                        where: {
                            id: _args.input.orderId
                        },
                        data: {
                            loyalty: loyaltyAmount
                        }
                    })

                    const customerId = order.customerId
                    const updateCustomerLoyalty = await tx.customer.update({
                        where: {
                            id: customerId
                        },
                        data: {
                            loyaltyPoints: {
                                decrement: _args.input.value
                            },
                        }
                    })
                    await loyaltyModel.setLoyaltyForOrderItems(tx, _args.input.orderId, _args.input.loyaltyType, _args.input.loyaltyWorth, _args.input.value, 0)

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.setLoyaltyForOrder,
                            orderId: _args.input.orderId,
                            f1: _args.input.loyaltyName,
                            f2: _args.input.loyaltyType,
                            f3: _args.input.value.toString(),
                            f4: _args.input.loyaltyWorth.toString(),
                        }
                    })

                    return creation
                });
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    returnOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const items = await tx.orderItem.findMany({
                        where: {
                            orderId: _args.input.orderId,
                            isRestockForReturn: true
                        },
                        select: {
                            productId: true,
                            quantity: true,
                            packageLabel: true
                        }
                    })
                    const updateStock = async (packageLabel: string, quantity: number) => {
                        try {
                            await tx.product.update({
                                where: {
                                    packageLabel: packageLabel,
                                },
                                data: {
                                    posQty: {
                                        increment: truncateToTwoDecimals(quantity)
                                    },
                                }
                            })
                        } catch (err) {
                            console.log("::err", err)
                        } finally {
                            // console.log("::ended subaction")
                        }
                    }
                    await Promise.all(items.map((item: any) => updateStock(item.packageLabel, item.quantity)))

                    const updating = await tx.order.update({
                        where: {
                            id: _args.input.orderId,
                        },
                        data: {
                            status: OrderStatus.PAID,
                            cashAmount: _args.input.amount,
                            changeDue: _args.input.changeDue,
                            discount: _args.input.discount,
                            cost: _args.input.cost,
                            returnReason: _args.input.returnReason,

                        }
                    });

                    const deletionCustomerInQueue = await tx.customerQueue.deleteMany({
                        where: {
                            customerId: _args.input.customerId
                        }
                    })

                    return updating
                });
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateOrganization: async (_parent, _args, context) => {
        if (context.role.includes(UserType.ADMIN_MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.organization.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            name: _args.input.name,
                            orgLinkName: _args.input.name.replace(/\s+/g, '').toLowerCase(),
                            phone: _args.input.phone,
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateOrganization,
                            f1: updating.name,
                            f2: updating.phone,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateDispensary: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.dispensary.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            name: _args.input.name,
                            storeLinkName: _args.input.name.replace(/\s+/g, '').toLowerCase(),
                            dispensaryType: _args.input.dispensaryType,
                            cannabisLicense: _args.input.cannabisLicense,
                            cannabisLicenseExpireDate: _args.input.cannabisLicenseExpireDate,
                            businessLicense: _args.input.businessLicense,
                            phone: _args.input.phone,
                            email: _args.input.email,
                            locationAddress: _args.input.locationAddress,
                            locationCity: _args.input.locationCity,
                            locationState: _args.input.locationState,
                            locationZipCode: _args.input.locationZipCode,
                            isActive: _args.input.isActive,
                            isCustomerAgeVerify: _args.input.isCustomerAgeVerify,
                            customerAgeLimit: _args.input.customerAgeLimit,
                            storeTimeZone: _args.input.storeTimeZone,
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateDispensary,
                            f1: updating.name,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateSmsByDispensaryId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.dispensary.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            smsOrderStart: _args.input.smsOrderStart,
                            smsOrderEnd: _args.input.smsOrderEnd,
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateSmsByDispensaryId,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateSupplier: async (_parent, _args, context) => {
        if (context.role.includes(UserType.ADMIN_MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.supplier.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            name: _args.input.name,
                            supplierType: _args.input.supplierType,
                            businessLicense: _args.input.businessLicense,
                            UBI: _args.input.UBI,
                            phone: _args.input.phone,
                            email: _args.input.email,
                            locationAddress: _args.input.locationAddress,
                            locationCity: _args.input.locationCity,
                            locationState: _args.input.locationState,
                            locationZipCode: _args.input.locationZipCode,
                            isActive: _args.input.isActive
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateSupplier,
                            f1: updating.name,
                            f2: updating.businessLicense
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    changePassword: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {

                const isOldpasswordTrue = await userModel.checkOldpassword(context, _args.userId, _args.oldPassword)
                return context.prisma.$transaction(async (tx) => {
                    if (isOldpasswordTrue) {
                        const updating = await tx.user.update({
                            where: {
                                id: _args.userId,
                            },
                            data: {
                                password: _args.newPassword,
                            }
                        });
                        const actionHistory = await tx.actionHistory.create({
                            data: {
                                dispensaryId: context.userInfo.dispensaryId,
                                userId: context.userInfo.userId,
                                userName: context.userInfo.name,
                                actionName: ActionNameList.changePassword,
                                f1: updating.name,
                            }
                        })
                        return updating;
                    } else {
                        return null
                    }
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateUser: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.user.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            userType: _args.input.userType,
                            email: _args.input.email,
                            name: _args.input.name,
                            phone: _args.input.phone,
                            isActive: _args.input.isActive,
                            isOrganizationAdmin: _args.input.isOrganizationAdmin,
                            isDispensaryAdmin: _args.input.isDispensaryAdmin,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateUser,
                            f1: updating.name,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateAdmin: async (_parent, _args, context) => {
        if (context.role.includes(UserType.SUPER_ADMIN_MANAGER_USER)) {
            try {
                const updating = await context.prisma.user.update({
                    where: {
                        id: _args.input.id,
                    },
                    data: {
                        userType: _args.input.userType,
                        email: _args.input.email,
                        name: _args.input.name,
                        phone: _args.input.phone,
                        isActive: _args.input.isActive,
                        isOrganizationAdmin: _args.input.isOrganizationAdmin,
                        isDispensaryAdmin: _args.input.isDispensaryAdmin,
                    }
                });
                return updating;
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateCustomer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.customer.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            name: _args.input.name.toUpperCase(),
                            MFType: _args.input.MFType,
                            birthday: new Date(_args.input.birthday).toLocaleDateString('en-US'),
                            email: _args.input.email,
                            phone: _args.input.phone,
                            isActive: _args.input.isActive,
                            driverLicense: _args.input.driverLicense.toUpperCase(),
                            driverLicenseExpirationDate: new Date(_args.input.driverLicenseExpirationDate).toLocaleDateString('en-US'),
                            isMedical: _args.input.isMedical,
                            medicalLicense: _args.input.medicalLicense.toUpperCase(),
                            medicalLicenseExpirationDate: new Date(_args.input.medicalLicenseExpirationDate).toLocaleDateString('en-US'),
                            status: _args.input.status,
                            loyaltyPoints: _args.input.loyaltyPoints,
                            isTaxExempt: _args.input.isTaxExempt,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateCustomer,
                            f1: updating.name,
                            f2: updating.medicalLicense,
                            customerId: _args.input.id
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateCustomerToUpperCase: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const updating = await context.prisma.$executeRaw`
                UPDATE "Customer"
                    SET
                        "name" = UPPER("name"),
                        "medicalLicense" = UPPER("medicalLicense"),
                        "driverLicense" = UPPER("driverLicense")
                    WHERE "dispensaryId" = ${_args.dispensaryId}
                `;
                console.log("updatemany >>> ", updating)
                return {
                    count: updating
                }
            } catch (e) {
                handlePrismaError(e)
                return null
            }
        }
        else return throwUnauthorizedError()
    },
    updateOrderToReturn: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {

            const itemCount = await context.prisma.orderItem.count({
                where: {
                    orderId: _args.input.orderId,
                },
            });

            if (itemCount > 0) return throwManualError(400, "To be a Return type order please remove all products in the order #" + _args.input.orderId + ". Or you can create a new order")

            try {
                const updating = await context.prisma.order.update({
                    where: {
                        id: _args.input.orderId,
                    },
                    data: {
                        orderType: OrderType.RETURN,
                        originalOrder: _args.input.originalOrderId
                    }
                });
                return updating;
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    setRestockForOrderItem: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const updating = await context.prisma.orderItem.update({
                    where: {
                        id: _args.input.id,
                    },
                    data: {
                        isRestockForReturn: _args.input.trueFalse
                    }
                });
                return updating;
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    holdOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.order.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            status: OrderStatus.HOLD,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.holdOrder,
                            orderId: updating.id,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    cancelOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const order = await context.prisma.order.findUnique({
                where: {
                    id: _args.input.id
                }
            })
            if (order.status !== OrderStatus.EDIT) return throwManualError(400, "Only EDIT status orders can be cancelled.")
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletionTaxHistory = await tx.taxHistory.deleteMany({
                        where: {
                            orderId: _args.input.id,
                        },
                    });
                    const deletionDiscountHistory = await tx.discountHistory.deleteMany({
                        where: {
                            orderId: _args.input.id,
                        },
                    });
                    const deletionLoyaltyHistory = await tx.loyaltyHistory.deleteMany({
                        where: {
                            orderId: _args.input.id,
                        },
                    });
                    const deletionItems = await tx.orderItem.deleteMany({
                        where: {
                            orderId: _args.input.id,
                        },
                    });
                    const deletion = await tx.order.delete({
                        where: {
                            id: _args.input.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.cancelOrder,
                            f1: _args.input.id.toString(),
                        }
                    })
                    return deletion;
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    bulkCancelOrderByDrawerId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const orders = await tx.order.findMany({
                        where: {
                            drawerId: _args.drawerId,
                            status: OrderStatus.EDIT
                        }
                    })
                    for (let i = 0; i < orders.length; i++) {
                        const deletionTaxHistory = await tx.taxHistory.deleteMany({
                            where: {
                                orderId: orders[i].id,
                            },
                        });
                        const deletionDiscountHistory = await tx.discountHistory.deleteMany({
                            where: {
                                orderId: orders[i].id,
                            },
                        });
                        const deletionLoyaltyHistory = await tx.loyaltyHistory.deleteMany({
                            where: {
                                orderId: orders[i].id,
                            },
                        });
                        const deletionItems = await tx.orderItem.deleteMany({
                            where: {
                                orderId: orders[i].id,
                            },
                        });
                        const actionHistory = await tx.actionHistory.create({
                            data: {
                                dispensaryId: context.userInfo.dispensaryId,
                                userId: context.userInfo.userId,
                                userName: context.userInfo.name,
                                actionName: ActionNameList.bulkCancelOrderByDrawerId,
                                f1: orders[i].id.toString(),
                            }
                        })
                    }
                    const deletion = await tx.order.deleteMany({
                        where: {
                            drawerId: _args.drawerId,
                            status: OrderStatus.EDIT,
                        },
                    });
                    return deletion;

                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    unHoldOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.order.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            status: OrderStatus.EDIT,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.unHoldOrder,
                            orderId: updating.id,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    voidOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            const order = await context.prisma.order.findUnique({
                where: {
                    id: _args.input.id
                }
            })
            if (order.status !== OrderStatus.PAID) return throwManualError(400, "The order #" + _args.input.id + " can not be voided.")

            try {
                let posUpdateResult: any
                const updatedResult = await context.prisma.$transaction(async (tx) => {
                    const items = await tx.orderItem.findMany({
                        where: {
                            orderId: _args.input.id,
                        },
                        select: {
                            productId: true,
                            quantity: true,
                            packageLabel: true
                        }
                    })

                    const updateStock = async (packageLabel: string, quantity: number) => {
                        try {
                            const increaseStock = await tx.assignPackage.update({
                                where: {
                                    packageLabel: packageLabel,
                                },
                                data: {
                                    posQty: {
                                        increment: truncateToTwoDecimals(quantity)
                                    },
                                }
                            })
                            const decreaseStockForPackage = await tx.package.update({
                                where: {
                                    packageLabel: packageLabel,
                                },
                                data: {
                                    posQty: increaseStock.posQty
                                }
                            })
                        } catch (err) {
                            console.log("::err", err)
                        } finally {
                            // console.log("::ended subaction")
                        }
                    }
                    await Promise.all(items.map((item: any) => updateStock(item.packageLabel, item.quantity)))

                    const currentDateTime = new Date();
                    const updating = await tx.order.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            status: OrderStatus.VOID,
                            voidReason: _args.input.voidReason,
                            voidedAt: currentDateTime.toISOString(),
                        }
                    });
                    posUpdateResult = updating;
                })

                let posSuccess, metrcSuccess

                const metrcReportResult = await metrcModel.delMetrcReceipt(context, order.dispensaryId, order.metrcId, _args.input.id)
                posSuccess = posUpdateResult?.id ? true : false
                metrcSuccess = metrcReportResult === true ? 'success' : 'failed'

                let response: any = {
                    pos: posSuccess,
                    metrc: metrcSuccess
                }

                const actionHistory = await context.prisma.actionHistory.create({
                    data: {
                        dispensaryId: context.userInfo.dispensaryId,
                        userId: context.userInfo.userId,
                        userName: context.userInfo.name,
                        actionName: ActionNameList.voidOrder,
                        orderId: _args.input.id,
                        customerId: order.customerId,
                        f1: metrcSuccess
                    }
                })

                return response

            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    endDrawer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const editCount = await context.prisma.order.count({
                where: {
                    status: OrderStatus.EDIT,
                    drawerId: _args.input.id
                },
            });

            if (editCount > 0) return throwManualError(400, "There are EDIT orders in the current Register")
            try {
                return context.prisma.$transaction(async (tx) => {

                    const updating = await tx.drawer.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            endAmount: _args.input.endAmount,
                            totalDeposite: _args.input.totalDeposite,
                            comment: _args.input.comment,
                            discrepancyReason: _args.input.discrepancyReason,
                            status: DrawerStatus.COMPLETED,
                            isUsing: false,
                            endedAt: new Date(),
                        }
                    });

                    const myDrawers = await tx.drawer.findMany({
                        where: {
                            userId: _args.input.userId,
                            status: DrawerStatus.PENDING,
                        },
                        orderBy: { register: "asc" },
                    })

                    if (myDrawers.length > 0) {
                        await tx.drawer.update({
                            where: {
                                id: myDrawers[0].id,
                            },
                            data: {
                                isUsing: true,
                            }
                        });
                    }

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.endDrawer,
                            targetRecordId: _args.input.id,
                            f1: updating.register,
                            f2: _args.input.endAmount.toString(),
                        }
                    })
                    return updating;
                })

            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    setUsingRegister: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const preUpdating = await tx.drawer.updateMany({
                        where: {
                            id: {
                                not: _args.input.id,
                            },
                            userId: _args.input.userId
                        },
                        data: {
                            isUsing: false,
                        },
                    });
                    const updating = await tx.drawer.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            isUsing: true,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.setUsingRegister,
                            f1: updating.register,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateTaxHistoryForOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return orderitemModel.updateTaxHistoryForOrder(context, _args.orderId)
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateProduct: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.product.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            supplierId: _args.input.supplierId,
                            itemCategoryId: _args.input.itemCategoryId,
                            name: _args.input.name,
                            sku: _args.input.sku,
                            upc: _args.input.upc,
                            price: _args.input.price,
                            productUnitOfMeasure: _args.input.productUnitOfMeasure,
                            unitOfUnitWeight: _args.input.unitOfUnitWeight,
                            unitOfNetWeight: _args.input.unitOfNetWeight,
                            unitWeight: _args.input.unitWeight,
                            isApplyUnitWeight: _args.input.isApplyUnitWeight,
                            netWeight: _args.input.netWeight,
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateProduct,
                            targetRecordId: updating.id,
                            f1: updating.name,
                            productId: updating.id
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateLoyalty: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.loyalty.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            name: _args.input.name,
                            type: _args.input.type,
                            pointWorth: _args.input.pointWorth,
                            applyDurationSet: _args.input.applyDurationSet,
                            applyFrom: _args.input.applyFrom,
                            applyTo: _args.input.applyTo,
                            isActive: _args.input.isActive,
                            isAdminPin: _args.input.isAdminPin,
                            color: _args.input.color,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateLoyalty,
                            targetRecordId: updating.id,
                            f1: updating.name,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateDiscount: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.discount.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            applyTarget: _args.input.applyTarget,
                            name: _args.input.name,
                            type: _args.input.type,
                            discountPercent: _args.input.discountPercent,
                            applyDurationSet: _args.input.applyDurationSet,
                            applyFrom: _args.input.applyFrom,
                            applyTo: _args.input.applyTo,
                            isActive: _args.input.isActive,
                            isAdminPin: _args.input.isAdminPin,
                            isEnterManualAmount: _args.input.isEnterManualAmount,
                            isLimitManualAmount: _args.input.isLimitManualAmount,
                            manualDiscountLimitPercent: _args.input.manualDiscountLimitPercent,
                            color: _args.input.color,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateDiscount,
                            targetRecordId: updating.id,
                            f1: updating.name,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateItemCategory: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.itemCategory.update({
                        where: {
                            id: _args.input.id,
                        },
                        data: {
                            metrcCategory: _args.input.metrcCategory,
                            containMj: _args.input.containMj,
                            name: _args.input.name,
                            color: _args.input.color,
                            purchaseLimitType: _args.input.purchaseLimitType,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateItemCategory,
                            targetRecordId: updating.id,
                            f1: updating.name,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateTaxSetting: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                const updating = await context.prisma.taxSetting.update({
                    where: {
                        id: _args.input.id,
                    },
                    data: {
                        name: _args.input.name,
                        rate: _args.input.rate,
                        categories: _args.input.categories,
                        applyTo: _args.input.applyTo,
                        compoundTaxes: _args.input.compoundTaxes,
                        isExcludeFromRecreational: _args.input.isExcludeFromRecreational,
                        isExcludeFromTaxExempt: _args.input.isExcludeFromTaxExempt,
                    }
                });

                const updateMjTaxApply = await taxSetting.updateTaxApply(context, _args.input.dispensaryId, TaxSettingApplyTo.MJ)
                const updateNmjTaxApply = await taxSetting.updateTaxApply(context, _args.input.dispensaryId, TaxSettingApplyTo.NMJ)

                const actionHistory = await context.prisma.actionHistory.create({
                    data: {
                        dispensaryId: context.userInfo.dispensaryId,
                        userId: context.userInfo.userId,
                        userName: context.userInfo.name,
                        actionName: ActionNameList.updateTaxSetting,
                        targetRecordId: updating.id,
                        f1: updating.name,
                        f2: updating.rate.toString()
                    }
                })
                return updating;
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateCustomerNoteByCustomerId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                const updating = await context.prisma.customer.update({
                    where: {
                        id: _args.input.customerId,
                    },
                    data: {
                        note: _args.input.note,
                    }
                });
                return updating;
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateCustomerByOrderId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const order = await context.prisma.order.findUnique({
                where: {
                    id: _args.input.orderId,
                }
            })
            if (order.status !== OrderStatus.EDIT) return throwManualError(400, "Order #" + _args.input.orderId + " is on " + order.status + " status")

            const itemCount = await context.prisma.orderItem.count({
                where: {
                    orderId: _args.input.orderId,
                },
            });

            if (itemCount > 0) return throwManualError(400, "To change customer please remove all products in the order #" + _args.input.orderId)

            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.order.update({
                        where: {
                            id: _args.input.orderId,
                        },
                        data: {
                            customerId: _args.input.customerId,
                            orderType: OrderType.SALE,
                            originalOrder: 0
                        },
                        include: {
                            customer: true
                        }
                    });
                    const actionHistory = await context.prisma.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.updateCustomerByOrderId,
                            orderId: updating.id,
                            customerId: _args.input.customerId,
                            f1: updating.customer.name,
                            f2: updating.customer.medicalLicense
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    metrcConnectionUpdate: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const updating = await tx.dispensary.update({
                        where: {
                            id: _args.input.dispensaryId,
                        },
                        data: {
                            metrcConnectionStatus: _args.input.metrcConnectionStatus,
                            metrcApiKey: _args.input.metrcApiKey,
                        }
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.metrcConnectionUpdate,
                        }
                    })
                    return updating;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteOrganization: async (_parent, _args, context) => {
        if (context.role.includes(UserType.SUPER_ADMIN_MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.organization.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteOrganization,
                            f1: deletetion.name
                        }
                    })
                    return deletetion;
                })

            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteDispensary: async (_parent, _args, context) => {
        if (context.role.includes(UserType.ADMIN_MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.dispensary.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteDispensary,
                            f1: deletetion.name
                        }
                    })
                    return deletetion;
                })

            }
            catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteSupplier: async (_parent, _args, context) => {
        if (context.role.includes(UserType.ADMIN_MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.supplier.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteSupplier,
                            f1: deletetion.name,
                            f2: deletetion.businessLicense
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteUser: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.user.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteUser,
                            f1: deletetion.name
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteCustomer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.customer.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteCustomer,
                            f1: deletetion.name,
                            f2: deletetion.medicalLicense
                        }
                    })
                    return deletetion;
                })

            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteCustomerQueue: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const deletetion = await context.prisma.customerQueue.delete({
                    where: {
                        id: _args.id,
                    },
                });
                return deletetion;
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteCustomerQueueByCustomerId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const deletetion = await context.prisma.customerQueue.deleteMany({
                    where: {
                        customerId: _args.customerId,
                    },
                });
                return deletetion;
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteProduct: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.product.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteProduct,
                            f1: deletetion.name,
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteLoyalty: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.loyalty.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteLoyalty,
                            f1: deletetion.name,
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteDiscount: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.discount.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteDiscount,
                            f1: deletetion.name,
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    cancelReconcile: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.adjustPackage.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.cancelReconcile,
                            f1: deletetion.packageLabel,
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    cancelDiscountForOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const setZeroForDiscountedAmount = await tx.orderItem.updateMany({
                        where: {
                            orderId: _args.orderId,
                        },
                        data: {
                            discountedAmount: 0,
                        },
                    });
                    const deletetion = await tx.discountHistory.deleteMany({
                        where: {
                            orderId: _args.orderId,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.cancelDiscountForOrder,
                            orderId: _args.orderId,
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    cancelLoyaltyForOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const setZeroForLoyaltyAmount = await tx.orderItem.updateMany({
                        where: {
                            orderId: _args.orderId,
                        },
                        data: {
                            loyaltyAmount: 0,
                        },
                    });
                    const deletetion = await tx.loyaltyHistory.deleteMany({
                        where: {
                            orderId: _args.orderId,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.cancelLoyaltyForOrder,
                            orderId: _args.orderId,
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteItemCategory: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const deletetion = await tx.itemCategory.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteItemCategory,
                            f1: deletetion.name,
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteTransfer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const transfer = await tx.transfer.findUnique({
                        where: {
                            id: _args.id
                        }
                    })
                    if (transfer.isMJ == true || transfer.assignedPackageCount > 0) return null
                    const deletetion = await tx.transfer.delete({
                        where: {
                            id: _args.id,
                        },
                    });
                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteTransfer,
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteTaxSetting: async (_parent, _args, context) => {
        if (context.role.includes(UserType.MANAGER_USER)) {
            try {
                const deletetion = await context.prisma.taxSetting.delete({
                    where: {
                        id: _args.id,
                    },
                });
                const updateMjTaxApply = await taxSetting.updateTaxApply(context, _args.dispensaryId, TaxSettingApplyTo.MJ)
                const updateNmjTaxApply = await taxSetting.updateTaxApply(context, _args.dispensaryId, TaxSettingApplyTo.NMJ)

                const actionHistory = await context.prisma.actionHistory.create({
                    data: {
                        dispensaryId: context.userInfo.dispensaryId,
                        userId: context.userInfo.userId,
                        userName: context.userInfo.name,
                        actionName: ActionNameList.deleteTaxSetting,
                        f1: deletetion.name
                    }
                })
                return deletetion;
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteOrderItem: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const taxHistoryDeletion = await tx.taxHistory.deleteMany({
                        where: {
                            orderItemId: _args.id,
                        },
                    });
                    const orderItem = await tx.orderItem.findUnique({
                        where: {
                            id: _args.id,
                        },
                        include: {
                            product: true,
                            package: true
                        }
                    });

                    //consider discount
                    const discountHistory = await tx.discountHistory.findMany({
                        where: { orderId: orderItem.orderId || undefined },
                    })
                    let discountedAmount = 0
                    if (discountHistory.length > 0) {
                        discountedAmount = await discountModel.setDiscountForOrderItems(tx, orderItem.orderId, discountHistory[0].discountMethod, discountHistory[0].value, 0.0 - orderItem.amount)
                    }

                    //consider loyalty
                    let loyaltyAmount = 0
                    const loyaltyHistory = await tx.loyaltyHistory.findMany({
                        where: { orderId: orderItem.orderId || undefined },
                    })
                    if (loyaltyHistory.length > 0) {
                        loyaltyAmount = await loyaltyModel.setLoyaltyForOrderItems(tx, orderItem.orderId, loyaltyHistory[0].loyaltyType, loyaltyHistory[0].loyaltyWorth, loyaltyHistory[0].value, 0 - orderItem.amount)
                    }

                    const deletetion = await tx.orderItem.delete({
                        where: {
                            id: _args.id,
                        },
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.deleteOrderItem,
                            orderId: orderItem.orderId,
                            packageLabel: orderItem.packageLabel,
                            productId: orderItem.productId,
                            targetRecordId: _args.id,
                            f1: orderItem.product.name,
                            f2: orderItem.packageLabel
                        }
                    })
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteOrderItemsByOrderId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const taxHistoryDeletion = await tx.taxHistory.deleteMany({
                        where: {
                            orderId: _args.orderId,
                        },
                    });
                    const deletetion = await tx.orderItem.deleteMany({
                        where: {
                            orderId: _args.orderId,
                        },
                    });
                    return deletetion;
                })
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    deleteOrderItemsByDispensaryId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const orders = await context.prisma.order.findMany({
                    where: {
                        dispensaryId: _args.dispensaryId
                    }
                })
                for (let i = 0; i < orders.length; i++) {
                    console.log(orders[i].id)
                    await context.prisma.$transaction(async (tx) => {
                        const taxHistoryDeletion = await tx.taxHistory.deleteMany({
                            where: {
                                orderId: orders[i].id,
                            },
                        });
                        const deletetion = await tx.orderItem.deleteMany({
                            where: {
                                orderId: orders[i].id,
                            },
                        });
                    })
                }

            } catch (e) {
                handlePrismaError(e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    syncMetrcItemCategory: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const metrcDataInput = await metrcModel.getMetrcItemCategoryData(_args, context)
                // console.log(metrcDataInput, "----------------------------")
                const creation = await context.prisma.metrcItemCategory.createMany({
                    data: metrcDataInput,
                    skipDuplicates: true // Optional: skip duplicates if unique constraints exist  
                });
                console.log('Metrc Item Category data imported:', creation.count, 'records');
                return creation;
            } catch (e) {
                console.log("error>>>>", e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    syncAdjustmentReasons: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const metrcDataInput = await metrcModel.getMetrcAdjustmentReasonsData(_args, context)
                const creation = await context.prisma.metrcAdjustmentReasons.createMany({
                    data: metrcDataInput,
                    skipDuplicates: true // Optional: skip duplicates if unique constraints exist  
                });
                console.log('Metrc Adjustment Reasons data imported:', creation.count, 'records');
                return creation;
            } catch (e) {
                console.log("error>>>>", e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    reconcilePackageWithMetrcByAdjustId: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const pendingAdjust = await context.prisma.adjustPackage.findUnique({
                    where: {
                        id: _args.input.adjustmentId
                    },
                    include: {
                        package: true
                    }
                })
                if (pendingAdjust.syncMetrc === true) return throwManualError(400, 'Current record was synced in the past.')
                if (pendingAdjust.needMetrcSync === false) return throwManualError(400, 'This record can not be synced.')
                const syncMetrc = await metrcModel.postAdjustOnePackage(context, _args.input.dispensaryId, pendingAdjust)
                if (syncMetrc != 200) return throwManualError(400, "Error syncing with Metrc.")
                const update = await context.prisma.adjustPackage.update({
                    where: {
                        id: _args.input.adjustmentId
                    },
                    data: {
                        syncMetrc: true
                    }
                })
                const actionHistory = await context.prisma.actionHistory.create({
                    data: {
                        dispensaryId: context.userInfo.dispensaryId,
                        userId: context.userInfo.userId,
                        userName: context.userInfo.name,
                        actionName: ActionNameList.reconcilePackageWithMetrcByAdjustId,
                        packageLabel: pendingAdjust.package.packageLabel,
                        targetRecordId: _args.input.adjustmentId,
                        f1: syncMetrc.toString(),
                        f2: pendingAdjust.newQty.toString(),
                        f3: pendingAdjust.deltaQty.toString()
                    }
                })
                return update;
            } catch (e) {
                console.log("error>>>>", e)
                handlePrismaError(e)
                return e
            }
        }
        else return throwUnauthorizedError()
    },
    importSuppliers: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let creation: any
                const supplierDataInput = await supplierModel.getSupplierDataFromPackages(_args, context)
                creation = await context.prisma.supplier.createMany({
                    data: supplierDataInput,
                    skipDuplicates: true // Optional: skip duplicates if unique constraints exist  
                });
                console.log('Supplier data imported:', creation.count, 'records');
                return creation
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    updateTransferIdForAssignPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const deliveryPackages = await context.prisma.deliveryPackages.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                    },
                    include: {
                        transfer: true
                    }
                })
                for (let i = 0; i < deliveryPackages.length; i++) {
                    console.log(i, deliveryPackages[i].packageLabel, deliveryPackages[i].transfer.id)
                    const existingAssignPackage = await context.prisma.assignPackage.findUnique({
                        where: { packageLabel: deliveryPackages[i].packageLabel }
                    });

                    if (existingAssignPackage) {
                        // Update only if record exists
                        await context.prisma.assignPackage.update({
                            where: { packageLabel: deliveryPackages[i].packageLabel },
                            data: { transferId: deliveryPackages[i].transfer.id }
                        });
                    } else {
                        console.warn(`AssignPackage with packageLabel ${deliveryPackages[i].packageLabel} not found.`);
                        // Optionally, handle missing record case
                    }
                }

                const allTransfers = await context.prisma.transfer.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                    },
                    include: {
                        _count: {
                            select: {
                                AssignPackage: true
                            }
                        }
                    },
                })

                for (let i = 0; i < allTransfers.length; i++) {
                    const updateTransfer = await context.prisma.transfer.update({
                        where: {
                            id: allTransfers[i].id,
                        },
                        data: {
                            assignedPackageCount: allTransfers[i]._count.AssignPackage,
                        }
                    })
                }

            } catch (e) {
                console.log('importMetrcPackage:', e);
                handlePrismaError(e)
            }
            return null
        }
        else return throwUnauthorizedError()
    },
    syncPosqtyWithAssignPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const assignPackages = await context.prisma.assignPackage.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                    },
                })
                for (const item of assignPackages) {
                    console.log("package >>> ", item.packageLabel)
                    await context.prisma.package.update({
                        where: {
                            packageLabel: item.packageLabel
                        },
                        data: {
                            posQty: item.posQty,
                        }
                    })
                }
                console.log("syncPosqtyWithAssignPackage Complete!")
                return {
                    count: assignPackages.length
                }
            } catch (e) {
                console.log('importMetrcPackage:', e);
                handlePrismaError(e)
            }
            return null
        }
        else return throwUnauthorizedError()
    },
    setMjTypeForOrderItems: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const orders = await context.prisma.order.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                    },
                })
                let i = 0
                for (const order of orders) {
                    console.log("order Id >>> ", order.id, "---", orders.length - i)
                    i++
                    const orderItems = await context.prisma.orderItem.findMany({
                        where: {
                            orderId: order.id
                        },
                        include: {
                            package: true,
                        }
                    })
                    for (const oneItem of orderItems) {
                        if (oneItem.package) {
                            if (oneItem.package.packageId > 0) {
                                await context.prisma.orderItem.update({
                                    where: {
                                        id: oneItem.id
                                    },
                                    data: {
                                        mjType: OrderMjType.MJ
                                    }
                                })
                            } else {
                                await context.prisma.orderItem.update({
                                    where: {
                                        id: oneItem.id
                                    },
                                    data: {
                                        mjType: OrderMjType.NMJ
                                    }
                                })
                            }
                        } else {
                            continue
                        }
                    }
                }
                console.log("setMjTypeForOrderItems Complete!")
                return {
                    count: orders.length
                }
            } catch (e) {
                console.log('setMjTypeForOrderItems:', e);
                handlePrismaError(e)
            }
            return null
        }
        else return throwUnauthorizedError()
    },
    importMetrcPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const syncHistory = await tx.syncHistory.findFirst({
                        where: {
                            dispensaryId: _args.input.dispensaryId,
                            syncType: SyncType.package,
                        },
                        orderBy: { createdAt: "desc" },
                    })

                    const createSyncHistory = await tx.syncHistory.create({
                        data: {
                            dispensaryId: _args.input.dispensaryId,
                            userId: _args.input.userId,
                            syncType: SyncType.package,
                            isSuccess: false,
                        }
                    })

                    const lastModifiedStart = syncHistory ? syncHistory.createdAt : 'defaultStartDate'

                    const activePackageData = await metrcModel.getMetrcActivePackageData(_args, context, lastModifiedStart)
                    const inActivePackageData = await metrcModel.getMetrcInactivePackageData(_args, context, lastModifiedStart)
                    const allNewUpdatedPackageData = activePackageData.concat(inActivePackageData)

                    for (let i = 0; i < allNewUpdatedPackageData.length; i++) {
                        // let packageForCreation: any = allNewUpdatedPackageData[i]
                        // packageForCreation.packageStatus = PackageStatus.PENDING
                        const packageUpdate = await tx.package.upsert({
                            where: { packageLabel: allNewUpdatedPackageData[i].packageLabel },
                            update: allNewUpdatedPackageData[i],
                            create: allNewUpdatedPackageData[i],
                        });
                    }
                    // console.log("metrcDataInput>>>", metrcDataInput)
                    let returnCount: any = {
                        count: allNewUpdatedPackageData.length
                    }
                    const isSuccess = allNewUpdatedPackageData.length > 0 ? true : false

                    console.log('Metrc package data imported:', allNewUpdatedPackageData.length, 'records');
                    return returnCount
                },
                    {
                        maxWait: 9999999, // default: 2000
                        timeout: 9999999, // default: 5000
                    })
            } catch (e) {
                console.log('importMetrcPackage:', e);
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    importMetrcPackageOriginalQuantity: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const packagesList = await context.prisma.package.findMany({
                    where: {
                        originalQty: 0
                    },
                })

                for (const item of packagesList) {
                    const metrcPackage = await metrcModel.getMetrcPackageInfoByPackageId(_args, context, item.packageId)
                    if (metrcPackage.OriginalPackageQuantity > 0) {
                        await context.prisma.package.update({
                            where: {
                                packageId: item.packageId
                            },
                            data: {
                                originalQty: truncateToTwoDecimals(metrcPackage.OriginalPackageQuantity)
                            }
                        })
                    }
                }

                let returnCount: any = {
                    count: Array.isArray(packagesList) ? packagesList.length : 0
                }
                console.log('Metrc package original quantity updated:', returnCount.count, 'records');
                return returnCount
            } catch (e) {
                console.log('importMetrcPackage:', e);
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    syncMetrcIncomingTransfer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let deliveryPackageData: any[] = []
                let onePageData: any

                return context.prisma.$transaction(async (tx) => {

                    //Import Transfer Data
                    const syncHistory = await tx.syncHistory.findFirst({
                        where: {
                            dispensaryId: _args.input.dispensaryId,
                            syncType: SyncType.transfer,
                        },
                        orderBy: { createdAt: "desc" },
                    })
                    const createSyncHistory = await tx.syncHistory.create({
                        data: {
                            dispensaryId: _args.input.dispensaryId,
                            userId: _args.input.userId,
                            syncType: SyncType.transfer,
                            isSuccess: false,
                        }
                    })

                    const lastModifiedStart = syncHistory ? syncHistory.createdAt : 'defaultStartDate'
                    const transferDataInput = await metrcModel.getMetrcIncomingTransfer(_args, context, lastModifiedStart)
                    for (let i = 0; i < transferDataInput.length; i++) {
                        const transfer = await context.prisma.transfer.upsert({
                            where: {
                                transferId: transferDataInput[i].transferId
                            },
                            update: transferDataInput[i],
                            create: transferDataInput[i],
                        })
                    }
                    console.log('Metrc incoming transfer data synced:', transferDataInput.length, 'records from ', lastModifiedStart);
                    const isSuccess = transferDataInput.length > 0 ? true : false
                    const packageList = await tx.package.findMany({
                        select: {
                            packageId: true
                        },
                        where: {
                            dispensaryId: _args.input.dispensaryId,
                            packageId: {
                                gt: 0
                            }
                        },
                        orderBy: { packageId: "desc" },
                    })
                    // console.log(packageList)
                    const packageListArray = packageList.map(item => item.packageId);
                    // Import Delivery Data
                    for (let i = 0; i < transferDataInput.length; i++) {
                        onePageData = await metrcModel.getMetrcDeliveryPackagesByDeliveryId(_args, context, transferDataInput[i].deliveryId)
                        deliveryPackageData.push(onePageData)
                    }

                    deliveryPackageData = await deliveryPackageData.flat()
                    const deliveryPackageFilterArray = await deliveryPackageData.map(b => b.packageId)
                    const deliveryPackageDataResult = await deliveryPackageData.filter(a => deliveryPackageFilterArray.includes(a.packageId))
                    // console.log(deliveryPackageDataResult)

                    for (let i = 0; i < deliveryPackageDataResult.length; i++) {
                        const packageId = parseInt(deliveryPackageDataResult[i].packageId)
                        try {
                            // console.log("packageId>>>>>> ", packageId)
                            // Check if the related package exists  
                            if (packageListArray.includes(packageId)) {
                                const deliveryPackageCreate = await tx.deliveryPackages.upsert({
                                    where: {
                                        packageId: packageId
                                    },
                                    update: deliveryPackageDataResult[i],
                                    create: deliveryPackageDataResult[i],
                                })

                            } else {
                                console.log(packageId, " is not included in packageList.");
                                continue
                            }
                            // console.log(i , "deliveryPackage >>> ", deliveryPackageCreate)
                        }
                        catch (e) {
                            handlePrismaError(e)
                            console.log(e)
                        }
                    }
                    console.log('Metrc deliver packages data synced:', deliveryPackageDataResult.length, 'records from ', lastModifiedStart);
                    let returnCount: any = {
                        count: transferDataInput.length || 0
                    }
                    return returnCount
                },
                    {
                        maxWait: 9999999, // default: 2000
                        timeout: 9999999, // default: 5000
                    }
                )
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    syncDeliveryPackages: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let creation: any
                const syncedCount = await metrcModel.syncMetrcDeliveryPackages(_args, context)
                console.log('Metrc delivery package data imported:', syncedCount, 'records');
                let returnCount: any = {
                    count: syncedCount
                }

                return returnCount
            } catch (e) {
                console.log("syncDeliveryPackages>>>", e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    syncMetrcReceipts: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const syncHistory = await context.prisma.syncHistory.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId,
                        syncType: SyncType.order,
                    },
                    orderBy: { createdAt: "desc" },
                })

                const createSyncHistory = await context.prisma.syncHistory.create({
                    data: {
                        dispensaryId: _args.input.dispensaryId,
                        userId: _args.input.userId,
                        syncType: SyncType.order,
                        isSuccess: false,
                    }
                })
                const lastModifiedStart = syncHistory.length > 0 ? syncHistory[0].createdAt : 'defaultStartDate'
                let orderIdList: any = []
                const orderDataInput = await metrcModel.getMetrcAllReceiptData(_args, context, lastModifiedStart)
                for (let i = 0; i < orderDataInput.length; i++) {
                    const order = await context.prisma.order.upsert({
                        where: {
                            metrcId: orderDataInput[i].metrcId
                        },
                        update: orderDataInput[i],
                        create: orderDataInput[i],
                    })
                    orderIdList.push(order.id)
                    // console.log("new order id ------", order.id)
                }
                console.log('Order data imported:', orderDataInput.length, 'records');

                //Import order item data from Metrc
                let orderItemsData: any[] = []
                const metrcInfo = await metrcModel.getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
                const metrcApiKey = metrcInfo.metrcApiKey
                const cannabisLicense = metrcInfo.cannabisLicense
                const metrcApiEndpoint = endPoints[metrcInfo.locationState]

                let where: any = {}
                where.dispensaryId = _args.input.dispensaryId
                if (lastModifiedStart !== 'defaultStartDate') where.id = {
                    in: orderIdList,
                }
                const orderList = await context.prisma.order.findMany({
                    where: where,
                    select: {
                        id: true,
                        metrcId: true
                    }
                });
                for (let i = 0; i < orderList.length; i++) {
                    const detailData = await metrcModel.getMetrcReceiptByIdDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, orderList[i].metrcId)
                    // receiptDetailData.push(detailData)
                    const orderItems = await detailData.Transactions
                    for (let j = 0; j < detailData.TotalPackages; j++) {
                        // console.log("item package -----", orderItems[j].PackageLabel)
                        try {
                            const orderItem = {
                                orderId: orderList[i].id,
                                packageLabel: orderItems[j].PackageLabel,
                                quantity: orderItems[j].QuantitySold,
                                price: Number(orderItems[j].TotalPrice.toFixed(2)) / Number(orderItems[j].QuantitySold.toFixed(2)) || 0,
                                cost: 0,
                                amount: orderItems[j].TotalPrice,
                                costAmount: 0,
                                metrcItemName: orderItems[j].ProductName,
                            }
                            console.log("item: ", j, " ", orderItem)
                            const orderItemCreate = await context.prisma.orderItem.create({
                                data: orderItem
                            })
                            orderItemsData.push(orderItem)
                            console.log(orderItem)
                        } catch (error: any) {
                            if (error.code === 'P2002' || error.code === 'P2003') {
                                // Log and ignore this error
                                // console.warn(`Foreign key constraint failed for item: ${orderItem}`);
                                continue; // skip to next iteration
                            } else {
                                throw error; // rethrow unexpected errors
                            }
                        }
                    }
                }

                console.log("orderItemData>>>", orderItemsData)

                try {
                    console.log("orderItem Creation result >>>>", orderItemsData.length)
                }
                catch (e) {
                    handlePrismaError(e)
                    console.log(e)
                }

                // let returnCount: any = {
                //     count: orderDataInput.length
                // }
                let returnCount: any = {
                    count: 0
                }

                return returnCount
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    syncMetrcReceiptsDetail: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                const syncedCount = await metrcModel.getMetrcReceiptDetailData(_args, context)
                // console.log(orderDataInput, "efefef")
                console.log('Order data imported:', syncedCount, 'records');
                let returnCount: any = {
                    count: syncedCount
                }

                return returnCount
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    createSyncHistory: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let creation: any
                creation = await context.prisma.syncHistory.create({
                    data: _args.input,
                });
                return creation
            } catch (e) {
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    importGrowflowCustomer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const results: any = []
            let customers: any = []
            // Replace 'path/to/your/file.csv' with the path to your CSV file
            try {
                await fs.createReadStream('./src/migration/growflow/customers.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {
                        // console.log(results);
                        customers = results.map(customerRecord => {
                            return {
                                name: customerRecord.Name,
                                birthday: customerRecord.Birthday,
                                email: customerRecord.Email,
                                phone: customerRecord.PhoneNumber,
                                dispensaryId: _args.input.dispensaryId,
                                isActive: true,
                                driverLicense: customerRecord.CustomerStateLicense,
                                driverLicenseExpirationDate: customerRecord.CustomerStateLicenseExpiration,
                                isMedical: true,
                                medicalLicense: customerRecord.MedicalLicenseNumber,
                                medicalLicenseExpirationDate: customerRecord.LicenseEffectiveEndDate,
                                loyaltyPoints: parseFloat(customerRecord.CurrentPoints) || 0,
                                status: CustomerStatus.MEDICALMEMBER,
                                note: customerRecord.Notes,
                                city: customerRecord.City,
                                usState: customerRecord.State,
                                zipCode: customerRecord.Zipcode,
                            }
                        })
                        // console.log(results)
                        for (let i = 0; i < customers.length; i++) {
                            const customerUpsert = await context.prisma.customer.upsert({
                                where: {
                                    dispensaryId_medicalLicense: {
                                        dispensaryId: _args.input.dispensaryId,
                                        medicalLicense: customers[i].medicalLicense,
                                    }
                                },
                                update: customers[i],
                                create: customers[i]
                            })
                        }

                        // const creation = await context.prisma.customer.createMany({
                        //     data: customers,
                        //     skipDuplicates: true
                        // });
                        console.log("Customer imported>>>>>", customers.length)
                    });
            } catch (e) {
                // console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    importGrowflowProduct: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {

            // Replace 'path/to/your/file.csv' with the path to your CSV file
            try {
                let products: any = []
                let results: any = []
                let supplierList: any = []
                let itemCategoryList: any = []
                const suppliers = await context.prisma.supplier.findMany({
                    where: {
                        organizationId: _args.input.organizationId
                    },
                })
                const itemCategory = await context.prisma.itemCategory.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })

                for (let i = 0; i < itemCategory.length; i++) {
                    itemCategoryList[itemCategory[i].name.replace(/\s/g, '').toLowerCase()] = itemCategory[i].id
                }
                for (let j = 0; j < suppliers.length; j++) {
                    // console.log(supplier[i].name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase())
                    if (!suppliers[j].name) continue
                    if (supplierList[suppliers[j].name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase()]) continue
                    supplierList[suppliers[j].name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase()] = suppliers[j].id
                    // console.log(supplier[j].name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase())
                    // console.log(supplier[j].id)
                }

                const unitTransfer = {
                    'Each': 'ea',
                    'Grams': 'g',
                    'Milligrams': 'mg',
                    'Ounces': 'oz',
                };

                await fs.createReadStream('./src/migration/growflow/products.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {

                        for (let i = 0; i < results.length; i++) {
                            console.log("number: ", i, "  >>  ", results.length)
                            if (!results[i].Name) continue
                            const product = {
                                dispensaryId: _args.input.dispensaryId,
                                userId: _args.input.userId,
                                supplierId: supplierList[results[i].Supplier.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase()] ? supplierList[results[i].Supplier.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase()] : _args.input.defaultSupplierId,
                                itemCategoryId: itemCategoryList[results[i].ProductCategory.replace(/\s/g, '').toLowerCase()] ? itemCategoryList[results[i].ProductCategory.replace(/\s/g, '').toLowerCase()] : _args.input.defaultItemCategoryId,
                                name: results[i].Name,
                                price: parseFloat(results[i].SalesPrice.replace(/[$,]/g, '')) / 100 || 0,
                                productUnitOfMeasure: unitTransfer[results[i].UnitOfMeasure] || 'ea',
                                unitWeight: parseFloat(results[i].UnitWeight) || 0,
                                netWeight: parseFloat(results[i].NetWeight) || 0,
                                isConnectedWithPackage: false,
                            }
                            console.log(i, "product>>>>>> ", product)
                            products.push(product)
                        }
                        const creation = await context.prisma.product.createMany({
                            data: products,
                            skipDuplicates: true
                        });
                        console.log("creation>>>>>", creation)

                    });

            } catch (e) {
                console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    importDutchieProduct: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {

            // Replace 'path/to/your/file.csv' with the path to your CSV file
            try {
                let products: any = []
                let results: any = []
                let supplierList: any = []
                let itemCategoryList: any = []
                const suppliers = await context.prisma.supplier.findMany({
                    where: {
                        organizationId: _args.input.organizationId
                    },
                })
                const itemCategory = await context.prisma.itemCategory.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })

                for (let i = 0; i < itemCategory.length; i++) {
                    itemCategoryList[itemCategory[i].name.replace(/\s/g, '').toLowerCase()] = itemCategory[i].id
                }
                for (let j = 0; j < suppliers.length; j++) {
                    // console.log(supplier[i].name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase())
                    if (!suppliers[j].name) continue
                    if (supplierList[suppliers[j].name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase()]) continue
                    supplierList[suppliers[j].name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase()] = suppliers[j].id
                    // console.log(supplier[j].name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase())
                    // console.log(supplier[j].id)
                }

                const unitTypeTransfer = {
                    'Quantity': 'ea',
                    'Weight': 'g',
                };
                console.log(itemCategoryList)
                await fs.createReadStream('./src/migration/dutchie/catalog.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {

                        for (let i = 0; i < results.length; i++) {
                            try {
                                console.log("number: ", i, "  >>  ", results.length)
                                if (!results[i].Product) continue
                                const product = {
                                    dispensaryId: _args.input.dispensaryId,
                                    userId: _args.input.userId,
                                    supplierId: supplierList[results[i].Vendor.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase()] ? supplierList[results[i].Vendor.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, '').toLowerCase()] : _args.input.defaultSupplierId,
                                    itemCategoryId: itemCategoryList[results[i].Category.replace(/\s/g, '').toLowerCase()] ? itemCategoryList[results[i].Category.replace(/\s/g, '').toLowerCase()] : _args.input.defaultItemCategoryId,
                                    name: results[i].Product,
                                    price: parseFloat(results[i].Price.replace(/[$,]/g, '')) || 0,
                                    productUnitOfMeasure: unitTypeTransfer[results[i].Type] || 'ea',
                                    unitWeight: 0,
                                    netWeight: parseFloat(results[i].Netweight) || 0,
                                    isConnectedWithPackage: false,
                                    otherPosUniqueId: results[i].SKU.replace(/\s/g, '').toLowerCase()
                                }
                                console.log(i, "product>>>>>> ", product)
                                products.push(product)
                            } catch (error) {
                                console.log(error)
                            }
                        }
                        const creation = await context.prisma.product.createMany({
                            data: products,
                            skipDuplicates: true
                        });
                        console.log("creation>>>>>", creation)

                    });

            } catch (e) {
                console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    importGrowflowAssignPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let results: any = []
                let assignAll: any = []
                let packageLabels: any = []
                let productIdByName: any = []
                let transferIdByDeliveryId: any = []
                let deliveryIdByPackageLabel: any = []
                let metrcQtyByPackageLabel: any = []
                const products = await context.prisma.product.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })
                const transfers = await context.prisma.transfer.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })
                // console.log("transfers>>>>>>>>>>> ", transfers)
                const deliveryPackages = await context.prisma.deliveryPackages.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })

                const packages = await context.prisma.package.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })

                for (let i = 0; i < products.length; i++) {
                    productIdByName[products[i].name.replace(/\s/g, '').toLowerCase()] = products[i].id
                }
                for (let i = 0; i < transfers.length; i++) {
                    transferIdByDeliveryId[transfers[i].deliveryId] = transfers[i].id
                }
                for (let i = 0; i < deliveryPackages.length; i++) {
                    deliveryIdByPackageLabel[deliveryPackages[i].packageLabel] = deliveryPackages[i].deliveryId
                }
                for (let i = 0; i < packages.length; i++) {
                    metrcQtyByPackageLabel[packages[i].packageLabel] = packages[i].Quantity
                }
                // console.log("deliveryIdByPackageLabel>>>>>>>>>>> ", deliveryIdByPackageLabel)
                await fs.createReadStream('./src/migration/growflow/packages.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {

                        for (let i = 0; i < results.length; i++) {
                            if (!results[i].CostPerItem) continue
                            const transferId = results[i].MetrcTag ? transferIdByDeliveryId[deliveryIdByPackageLabel[results[i].MetrcTag]] : _args.input.defaultNonMjTransferId
                            console.log(i, "MetrcTag>>", results[i].MetrcTag)
                            console.log(i, deliveryIdByPackageLabel[results[i].MetrcTag])
                            console.log(i, transferIdByDeliveryId[deliveryIdByPackageLabel[results[i].MetrcTag]])
                            console.log(i, "transferId>>", transferId)
                            let nonMjPackageId
                            if (!results[i].MetrcTag) {
                                console.log(_args.input.dispensaryId + '_' + results[i].PackageID + '_' + results[i].Product)
                                const createNonMjPackage = await context.prisma.package.upsert({
                                    where: {
                                        migrationIdForNonMjPackage: _args.input.dispensaryId + '_' + results[i].PackageID + '_' + results[i].Product,
                                    },
                                    update: {
                                        dispensaryId: _args.input.dispensaryId,
                                        nonMjTransferId: transferId,
                                        migrationIdForNonMjPackage: _args.input.dispensaryId + '_' + results[i].PackageID + '_' + results[i].Product,
                                        packageStatus: PackageStatus.ACTIVE,
                                        cost: parseFloat(results[i].CostPerItem.replace(/[$,]/g, '')),
                                        posQty: parseFloat(results[i].CurrentQty),
                                        originalQty: parseFloat(results[i].OriginalQuantity),
                                        isConnectedWithProduct: true,
                                        ReceivedDateTime: results[i].ActivatedAt
                                    },
                                    create: {
                                        dispensaryId: _args.input.dispensaryId,
                                        nonMjTransferId: transferId,
                                        migrationIdForNonMjPackage: _args.input.dispensaryId + '_' + results[i].PackageID + '_' + results[i].Product,
                                        packageStatus: PackageStatus.ACTIVE,
                                        cost: parseFloat(results[i].CostPerItem.replace(/[$,]/g, '')),
                                        posQty: parseFloat(results[i].CurrentQty),
                                        originalQty: parseFloat(results[i].OriginalQuantity),
                                        isConnectedWithProduct: true,
                                        ReceivedDateTime: results[i].ActivatedAt
                                    }
                                })
                                nonMjPackageId = createNonMjPackage.id
                                const updatePackageLabelForNonMjPackage = await context.prisma.package.update({
                                    where: {
                                        id: nonMjPackageId
                                    },
                                    data: {
                                        packageLabel: nonMjPackageId
                                    }
                                })

                            }
                            // console.log("update>>>>", updatePackageLabelForNonMjPackage)
                            const pLabel = results[i].MetrcTag ? results[i].MetrcTag : nonMjPackageId
                            const posQty = results[i].MetrcTag ? parseFloat(metrcQtyByPackageLabel[pLabel] || 0) : parseFloat(results[i].CurrentQty || 0)
                            if (packageLabels.includes(pLabel)) continue
                            const assignOne = {
                                dispensaryId: _args.input.dispensaryId,
                                userId: _args.input.userId,
                                transferId: transferId,
                                productId: productIdByName[results[i].Product.replace(/\s/g, '').toLowerCase()] ? productIdByName[results[i].Product.replace(/\s/g, '').toLowerCase()] : null,
                                packageLabel: pLabel,
                                originalQty: parseFloat(results[i].OriginalQuantity || 0),
                                posQty: posQty,
                                cost: parseFloat(results[i].CostPerItem.replace(/[$,]/g, '')),
                            }
                            assignAll.push(assignOne)
                            packageLabels.push(pLabel)
                        }
                        // console.log(assignAll)
                        const creation = await context.prisma.assignPackage.createMany({
                            data: assignAll,
                            skipDuplicates: true
                        });

                        for (const item of assignAll) {
                            await context.prisma.package.update({
                                where: {
                                    packageLabel: item.packageLabel
                                },
                                data: {
                                    posQty: item.posQty,
                                    isConnectedWithProduct: true,
                                }
                            })
                        }
                        // const updatePackages = await context.prisma.package.updateMany({
                        //     where: {
                        //         packageLabel: {
                        //             in: packageLabels
                        //         }
                        //     },
                        //     data: {
                        //         isConnectedWithProduct: true,
                        //     },
                        // });
                        console.log("AssignPackage imported: ", creation)
                    });
            } catch (e) {
                console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    importDutchieAssignPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let results: any = []
                let assignAll: any = []
                let packageLabels: any = []
                let productIdByName: any = []
                let transferIdByDeliveryId: any = []
                let deliveryIdByPackageLabel: any = []
                let metrcQtyByPackageLabel: any = []
                const products = await context.prisma.product.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })
                const transfers = await context.prisma.transfer.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })
                // console.log("transfers>>>>>>>>>>> ", transfers)
                const deliveryPackages = await context.prisma.deliveryPackages.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })

                const packages = await context.prisma.package.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })

                for (let i = 0; i < products.length; i++) {
                    productIdByName[products[i].name.replace(/\s/g, '').toLowerCase()] = products[i].id
                }
                for (let i = 0; i < transfers.length; i++) {
                    transferIdByDeliveryId[transfers[i].deliveryId] = transfers[i].id
                }
                for (let i = 0; i < deliveryPackages.length; i++) {
                    deliveryIdByPackageLabel[deliveryPackages[i].packageLabel] = deliveryPackages[i].deliveryId
                }
                for (let i = 0; i < packages.length; i++) {
                    metrcQtyByPackageLabel[packages[i].packageLabel] = packages[i].Quantity
                }
                // console.log("deliveryIdByPackageLabel>>>>>>>>>>> ", deliveryIdByPackageLabel)
                await fs.createReadStream('./src/migration/dutchie/inventory.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {

                        for (let i = 0; i < results.length; i++) {
                            if (!results[i].Cost) continue
                            const transferId = results[i].Iscannabis == 'Yes' ? transferIdByDeliveryId[deliveryIdByPackageLabel[results[i].PackageID]] : _args.input.defaultNonMjTransferId
                            console.log(i, "MetrcTag>>", results[i].PackageID)
                            console.log(i, deliveryIdByPackageLabel[results[i].PackageID])
                            console.log(i, transferIdByDeliveryId[deliveryIdByPackageLabel[results[i].PackageID]])
                            console.log(i, "transferId>>", transferId)
                            let nonMjPackageId
                            if (results[i].Iscannabis == 'No') {
                                console.log(_args.input.dispensaryId + '_' + results[i].PackageID + '_' + results[i].Product)
                                const createNonMjPackage = await context.prisma.package.upsert({
                                    where: {
                                        migrationIdForNonMjPackage: _args.input.dispensaryId + '_' + results[i].PackageID + '_' + results[i].Product,
                                    },
                                    update: {
                                        dispensaryId: _args.input.dispensaryId,
                                        nonMjTransferId: transferId,
                                        migrationIdForNonMjPackage: _args.input.dispensaryId + '_' + results[i].PackageID + '_' + results[i].Product,
                                        packageStatus: PackageStatus.ACTIVE,
                                        cost: parseFloat(results[i].Cost.replace(/[$,]/g, '')),
                                        posQty: parseFloat(results[i].Quantity),
                                        // originalQty: parseFloat(results[i].OriginalQuantity),
                                        isConnectedWithProduct: true,
                                        ReceivedDateTime: results[i].Inventorydate
                                    },
                                    create: {
                                        dispensaryId: _args.input.dispensaryId,
                                        nonMjTransferId: transferId,
                                        migrationIdForNonMjPackage: _args.input.dispensaryId + '_' + results[i].PackageID + '_' + results[i].Product,
                                        packageStatus: PackageStatus.ACTIVE,
                                        cost: parseFloat(results[i].Cost.replace(/[$,]/g, '')),
                                        posQty: parseFloat(results[i].Quantity),
                                        // originalQty: parseFloat(results[i].OriginalQuantity),
                                        isConnectedWithProduct: true,
                                        ReceivedDateTime: results[i].Inventorydate
                                    }
                                })
                                nonMjPackageId = createNonMjPackage.id
                                const updatePackageLabelForNonMjPackage = await context.prisma.package.update({
                                    where: {
                                        id: nonMjPackageId
                                    },
                                    data: {
                                        packageLabel: nonMjPackageId
                                    }
                                })

                            }
                            // console.log("update>>>>", updatePackageLabelForNonMjPackage)
                            const pLabel = results[i].Iscannabis == 'Yes' ? results[i].PackageID : nonMjPackageId
                            const posQty = results[i].Iscannabis == 'Yes' ? parseFloat(metrcQtyByPackageLabel[pLabel] || 0) : parseFloat(results[i].Quantity || 0)
                            if (packageLabels.includes(pLabel)) continue
                            const assignOne = {
                                dispensaryId: _args.input.dispensaryId,
                                userId: _args.input.userId,
                                transferId: transferId,
                                productId: productIdByName[results[i].Product.replace(/\s/g, '').toLowerCase()] ? productIdByName[results[i].Product.replace(/\s/g, '').toLowerCase()] : null,
                                packageLabel: pLabel,
                                // originalQty: parseFloat(results[i].OriginalQuantity || 0),
                                posQty: posQty,
                                cost: parseFloat(results[i].Cost.replace(/[$,]/g, '')),
                            }
                            assignAll.push(assignOne)
                            packageLabels.push(pLabel)
                        }
                        // console.log(assignAll)
                        const creation = await context.prisma.assignPackage.createMany({
                            data: assignAll,
                            skipDuplicates: true
                        });

                        for (const item of assignAll) {
                            await context.prisma.package.update({
                                where: {
                                    packageLabel: item.packageLabel
                                },
                                data: {
                                    posQty: item.posQty,
                                    isConnectedWithProduct: true,
                                }
                            })
                        }

                        // const updatePackages = await context.prisma.package.updateMany({
                        //     where: {
                        //         packageLabel: {
                        //             in: packageLabels
                        //         }
                        //     },
                        //     data: {
                        //         isConnectedWithProduct: true,
                        //     },
                        // });
                        console.log("AssignPackage imported: ", creation)
                    });
            } catch (e) {
                console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    adjustPackage: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    // console.log("eeee>>>>>>")
                    const updatePackage = await tx.assignPackage.update({
                        where: {
                            packageLabel: _args.input.packageLabel,
                        },
                        data: {
                            posQty: truncateToTwoDecimals(_args.input.newQty),
                        },
                        select: {
                            package: true
                        }
                    });

                    const updateStockForPackage = await tx.package.update({
                        where: {
                            packageLabel: _args.input.packageLabel,
                        },
                        data: {
                            posQty: truncateToTwoDecimals(_args.input.newQty)
                        }
                    })

                    const metrcQty = updatePackage.package.Quantity
                    const deltaQty = setFourDecimals(setFourDecimals(_args.input.newQty) - metrcQty)
                    const dd = {
                        dispensaryId: _args.input.dispensaryId,
                        packageLabel: _args.input.packageLabel,
                        newQty: setFourDecimals(_args.input.newQty),
                        metrcQty: metrcQty,
                        deltaQty: deltaQty,
                        reason: _args.input.reason,
                        notes: _args.input.notes,
                        needMetrcSync: _args.input.needMetrcSync,
                    }
                    console.log("dd >>>>> ", dd)
                    if (_args.input.needMetrcSync == true) {
                        await tx.adjustPackage.deleteMany({
                            where: {
                                packageLabel: _args.input.packageLabel,
                                needMetrcSync: true,
                                syncMetrc: false
                            }
                        })
                    }
                    const creation = await tx.adjustPackage.create({
                        data: {
                            dispensaryId: _args.input.dispensaryId,
                            packageLabel: _args.input.packageLabel,
                            newQty: setFourDecimals(_args.input.newQty),
                            deltaQty: deltaQty,
                            reason: _args.input.reason,
                            notes: _args.input.notes,
                            needMetrcSync: _args.input.needMetrcSync,
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.adjustPackage,
                            packageLabel: _args.input.packageLabel,
                            f1: setFourDecimals(_args.input.newQty).toString(),
                            f2: metrcQty.toString(),
                        }
                    })

                    return creation
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        } else return throwUnauthorizedError()
    },
    assignPackageToProduct: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const findPackage = await tx.assignPackage.findUnique({
                        where: {
                            packageLabel: _args.input.packageLabel,
                        }
                    })

                    if (!findPackage && _args.input.transferId) {
                        const increaseAssignCount = await tx.transfer.update({
                            where: {
                                id: _args.input.transferId
                            },
                            data: {
                                assignedPackageCount: {
                                    increment: 1
                                },
                            }
                        })
                    }
                    // console.log("eeee>>>>>>")
                    const creation = await tx.assignPackage.upsert({
                        where: {
                            packageLabel: _args.input.packageLabel,
                        },
                        create: {
                            dispensaryId: _args.input.dispensaryId,
                            userId: _args.input.userId,
                            productId: _args.input.productId,
                            transferId: _args.input.transferId,
                            originalQty: truncateToTwoDecimals(_args.input.quantity),
                            posQty: truncateToTwoDecimals(_args.input.quantity),
                            cost: truncateToTwoDecimals(_args.input.cost),
                            packageLabel: _args.input.packageLabel,
                        },
                        update: {
                            dispensaryId: _args.input.dispensaryId,
                            userId: _args.input.userId,
                            productId: _args.input.productId,
                            transferId: _args.input.transferId,
                            originalQty: truncateToTwoDecimals(_args.input.quantity),
                            posQty: truncateToTwoDecimals(_args.input.quantity),
                            cost: truncateToTwoDecimals(_args.input.cost),
                        }
                    });
                    const updatePackage = await tx.package.update({
                        where: {
                            packageLabel: _args.input.packageLabel,
                        },
                        data: {
                            // productId: _args.input.productId,
                            // cost: _args.input.cost,
                            posQty: truncateToTwoDecimals(_args.input.quantity),
                            packageStatus: PackageStatus.ACTIVE,
                            isConnectedWithProduct: true
                        }
                    });

                    const updatingProduct = await tx.product.update({
                        where: {
                            id: _args.input.productId,
                        },
                        data: {
                            isConnectedWithPackage: true
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.assignPackageToProduct,
                            packageLabel: _args.input.packageLabel,
                            productId: _args.input.productId,
                            f1: truncateToTwoDecimals(_args.input.quantity).toString(),
                            f2: updatingProduct.name
                        }
                    })
                    return creation
                })
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        } else return throwUnauthorizedError()
    },
    assignNonMjPackageToProduct: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                return context.prisma.$transaction(async (tx) => {
                    const findPackage = await tx.assignPackage.findUnique({
                        where: {
                            packageLabel: _args.input.packageId,
                        }
                    })

                    if (!findPackage) {
                        const increaseAssignCount = await tx.transfer.update({
                            where: {
                                id: _args.input.transferId
                            },
                            data: {
                                assignedPackageCount: {
                                    increment: 1
                                },
                                PackageCount: {
                                    increment: 1
                                },
                                ReceivedPackageCount: {
                                    increment: 1
                                },
                            }
                        })
                    }
                    const creation = await tx.assignPackage.upsert({
                        where: {
                            packageLabel: _args.input.packageId,
                        },
                        create: {
                            dispensaryId: _args.input.dispensaryId,
                            userId: _args.input.userId,
                            transferId: _args.input.transferId,
                            productId: _args.input.productId,
                            originalQty: truncateToTwoDecimals(_args.input.quantity),
                            posQty: truncateToTwoDecimals(_args.input.quantity),
                            cost: truncateToTwoDecimals(_args.input.cost),
                            packageLabel: _args.input.packageId,
                        },
                        update: {
                            dispensaryId: _args.input.dispensaryId,
                            userId: _args.input.userId,
                            transferId: _args.input.transferId,
                            productId: _args.input.productId,
                            originalQty: truncateToTwoDecimals(_args.input.quantity),
                            posQty: truncateToTwoDecimals(_args.input.quantity),
                            cost: truncateToTwoDecimals(_args.input.cost),
                        }
                    });
                    const updatePackage = await tx.package.update({
                        where: {
                            id: _args.input.packageId,
                        },
                        data: {
                            productId: _args.input.productId,
                            cost: truncateToTwoDecimals(_args.input.cost),
                            packageStatus: PackageStatus.ACTIVE,
                            isConnectedWithProduct: true,
                            originalQty: truncateToTwoDecimals(_args.input.quantity),
                            posQty: truncateToTwoDecimals(_args.input.quantity),
                        }
                    });

                    const updatingProduct = await tx.product.update({
                        where: {
                            id: _args.input.productId,
                        },
                        data: {
                            isConnectedWithPackage: true
                        }
                    });

                    const actionHistory = await tx.actionHistory.create({
                        data: {
                            dispensaryId: context.userInfo.dispensaryId,
                            userId: context.userInfo.userId,
                            userName: context.userInfo.name,
                            actionName: ActionNameList.assignPackageToProduct,
                            packageLabel: _args.input.packageId,
                            productId: _args.input.productId,
                            f1: truncateToTwoDecimals(_args.input.quantity).toString(),
                            f2: updatingProduct.name
                        }
                    })
                    return creation
                })
            } catch (e) {
                handlePrismaError(e)
            }
        } else return throwUnauthorizedError()
    },
    adjustGrowflowOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let creation: any
                let customerIdListByLicense: any = []
                const customers = await context.prisma.customer.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    }
                });
                for (let i = 0; i < customers.length; i++) {
                    customerIdListByLicense[customers[i].medicalLicense.replace(/\s/g, '').replace(/-/g, '').toLowerCase()] = customers[i].id
                }
                console.log(customerIdListByLicense)
                const orders = await context.prisma.order.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    }
                });
                let netAmount: any = []
                for (let i = 0; i < orders.length; i++) {
                    console.log(i, " orderId>>> ", orders[i].id)
                    if (!orders[i].cannabisLicense) continue
                    const customerId = customerIdListByLicense[orders[i].cannabisLicense.replace(/\s/g, '').replace(/-/g, '').toLowerCase()] ? customerIdListByLicense[orders[i].cannabisLicense.replace(/\s/g, '').replace(/-/g, '').toLowerCase()] : null
                    console.log(i, " customerId>>> ", customerId)
                    await context.prisma.order.update({
                        where: {
                            id: orders[i].id
                        },
                        data: {
                            customerId: customerId
                        }
                    })
                    netAmount[orders[i].metrcId] = truncateToTwoDecimals(orders[i].cashAmount)
                }
                console.log("netAmount>>>> ", netAmount)
                let results: any = []
                await fs.createReadStream('./src/migration/growflow/orders.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {

                        for (let i = 0; i < results.length; i++) {
                            // console.log("number: ", i, "  >>  ", results.length)
                            console.log("ExternalId>>> ", parseInt(results[i].ExternalId))
                            console.log("ExternalId AMount>>> ", netAmount[parseInt(results[i].ExternalId)])

                            if (!results[i].ExternalId) continue

                            if (!netAmount[parseFloat(results[i].ExternalId)]) continue

                            const netTotal = results[i].ExternalId ? netAmount[parseFloat(results[i].ExternalId)] : 0
                            const subTotal = parseFloat(results[i].Subtotal || 0) / 100
                            const grandTotal = parseFloat(results[i].GrandTotal || 0)
                            const discount = parseFloat(results[i].Discounts || 0)
                            const changeDue = parseFloat(results[i].ChangeDue || 0)
                            const tax = grandTotal - netTotal
                            const cash = grandTotal + changeDue
                            const orderValues = {
                                cashAmount: cash,
                                changeDue: changeDue,
                                discount: discount,
                                tax: tax,
                            }

                            const updateOrder = await context.prisma.order.update({
                                where: {
                                    metrcId: parseInt(results[i].ExternalId)
                                },
                                data: orderValues
                            })
                            // console.log(i, "updateOrder>>>>>>> ", updateOrder)
                        }
                    });
                console.log("Adjust Orders Complete!")
                return creation
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    adjustDutchieOrder: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let creation: any
                let customerIdListByLicense: any = []
                const customers = await context.prisma.customer.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    }
                });
                for (let i = 0; i < customers.length; i++) {
                    customerIdListByLicense[customers[i].medicalLicense.replace(/\s/g, '').replace(/-/g, '').toLowerCase()] = customers[i].id
                }
                console.log(customerIdListByLicense)
                const orders = await context.prisma.order.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    }
                });
                for (let i = 0; i < orders.length; i++) {
                    console.log(i, " orderId>>> ", orders[i].id)
                    if (!orders[i].cannabisLicense) continue
                    const customerId = customerIdListByLicense[orders[i].cannabisLicense.replace(/\s/g, '').replace(/-/g, '').toLowerCase()] ? customerIdListByLicense[orders[i].cannabisLicense.replace(/\s/g, '').replace(/-/g, '').toLowerCase()] : null
                    console.log(i, " customerId>>> ", customerId)
                    await context.prisma.order.update({
                        where: {
                            id: orders[i].id
                        },
                        data: {
                            customerId: customerId
                        }
                    })
                    const timeIndex = orders[i].salesDateTime
                }
                let results: any = []
                await fs.createReadStream('./src/migration/dutchie/transactions.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {

                        for (let i = 0; i < results.length; i++) {
                            // console.log("number: ", i, "  >>  ", results.length)
                            const timeIndex = new Date(results[i].Date).toISOString().slice(0, 19);
                            console.log("timeIndex>>> ", timeIndex)

                            // const netTotal = timeIndex ? netAmount[timeIndex] : 0
                            const tax = parseFloat(results[i].Tax || 0)
                            const discount = parseFloat(results[i].Discount || 0)
                            const cash = parseFloat(results[i].Total || 0)

                            const orderValues = {
                                cashAmount: cash,
                                changeDue: 0,
                                discount: discount,
                                tax: tax,
                            }

                            const updateOrder = await context.prisma.order.updateMany({
                                where: {
                                    dispensaryId: _args.input.dispensaryId,
                                    salesDateTime: timeIndex
                                },
                                data: orderValues
                            })
                            console.log(i, "orderValues>>>>>>> ", orderValues)
                        }
                    });
                console.log("Adjust Orders Complete!")
                return creation
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    adjustGrowflowOrderItem: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let creation: any
                let results: any = []
                let productNameByMetrcName: any = []
                let productIdByName: any = []
                let costByPackageLabel: any = []
                let orderAndCashAmount: any = []
                const products = await context.prisma.product.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })
                for (let i = 0; i < products.length; i++) {
                    productIdByName[products[i].name.replace(/\s/g, '').toLowerCase()] = products[i].id
                }
                await fs.createReadStream('./src/migration/growflow/packages.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {

                        for (let i = 0; i < results.length; i++) {
                            productNameByMetrcName[results[i].MetrcName.replace(/\s/g, '').toLowerCase()] = results[i].Product.replace(/\s/g, '').toLowerCase()
                            costByPackageLabel[results[i].MetrcTag] = parseFloat(results[i].CostPerItem.replace(/[$,]/g, ''))
                        }
                        const orderItems = await context.prisma.orderItem.findMany({
                            where: {
                                order: {
                                    dispensaryId: _args.input.dispensaryId
                                }
                            },
                            orderBy: {
                                order: {
                                    id: 'asc'
                                }
                            }
                        })

                        for (let i = 0; i < orderItems.length; i++) {

                            orderAndCashAmount[orderItems[i].orderId] = 0

                            const productNameGot = orderItems[i].metrcItemName ? productNameByMetrcName[orderItems[i].metrcItemName.replace(/\s/g, '').toLowerCase()] : ''

                            console.log(i, orderItems[i].orderId, "  ", orderItems[i].id, " ", orderItems[i].metrcItemName, "  ", productNameGot, "  ")

                            let productId = null

                            if (productIdByName[productNameGot]) productId = productIdByName[productNameGot.replace(/\s/g, '').toLowerCase()]
                            const cost = costByPackageLabel[orderItems[i].packageLabel] || 0
                            const costAmount = cost * orderItems[i].quantity
                            const updateData = {
                                productId: productId,
                                cost: cost,
                                costAmount: costAmount,
                            }
                            const update = await context.prisma.orderItem.update({
                                where: {
                                    id: orderItems[i].id
                                },
                                data: updateData
                            })

                            orderAndCashAmount[orderItems[i].orderId] += costAmount
                        }
                        const BATCH_SIZE = 5; // Adjust this value based on what your DB can handle  
                        for (let i = 0; i < orderAndCashAmount.length; i += BATCH_SIZE) {
                            const batch = orderAndCashAmount.slice(i, i + BATCH_SIZE);
                            await Promise.all(batch.map(async (val, index) => {
                                console.log(index, val)
                                const update = context.prisma.order.update({
                                    where: { id: index }, // Ensure val.id corresponds to your schema  
                                    data: { cost: val }, // Adjust data as necessary  
                                });
                            }));
                        }
                        console.log("Adjust OrderItems Complete!")
                    });


                return creation
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    adjustDutchieOrderItem: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            try {
                let creation: any
                let results: any = []
                let skuByPackageLabel: any = []
                let productIdBySku: any = []
                let costByPackageLabel: any = []
                let orderAndCashAmount: any = []
                const products = await context.prisma.product.findMany({
                    where: {
                        dispensaryId: _args.input.dispensaryId
                    },
                })
                for (let i = 0; i < products.length; i++) {
                    productIdBySku[products[i].otherPosUniqueId.replace(/\s/g, '').toLowerCase()] = products[i].id
                }
                console.log(productIdBySku)
                await fs.createReadStream('./src/migration/dutchie/inventory.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {

                        for (let i = 0; i < results.length; i++) {
                            skuByPackageLabel[results[i].PackageID] = results[i].SKU.replace(/\s/g, '').toLowerCase()
                            costByPackageLabel[results[i].PackageID] = parseFloat(results[i].Cost.replace(/[$,]/g, ''))
                        }
                        console.log(skuByPackageLabel)
                        const orderItems = await context.prisma.orderItem.findMany({
                            where: {
                                order: {
                                    dispensaryId: _args.input.dispensaryId
                                }
                            },
                            orderBy: {
                                order: {
                                    id: 'asc'
                                }
                            }
                        })

                        for (let i = 0; i < orderItems.length; i++) {

                            orderAndCashAmount[orderItems[i].orderId] = 0

                            const sku = skuByPackageLabel[orderItems[i].packageLabel]

                            // console.log(i, orderItems[i].orderId, "  ", orderItems[i].id, " ", orderItems[i].metrcItemName, "  ", orderItems[i].packageLabel, "    ", sku, "  ")

                            let productId = null

                            if (productIdBySku[sku]) productId = productIdBySku[sku]
                            const cost = costByPackageLabel[orderItems[i].packageLabel] || 0
                            const costAmount = cost * orderItems[i].quantity
                            const updateData = {
                                productId: productId,
                                cost: cost,
                                costAmount: costAmount,
                            }
                            const update = await context.prisma.orderItem.update({
                                where: {
                                    id: orderItems[i].id
                                },
                                data: updateData
                            })

                            orderAndCashAmount[orderItems[i].orderId] += costAmount
                        }
                        const BATCH_SIZE = 5; // Adjust this value based on what your DB can handle  
                        for (let i = 0; i < orderAndCashAmount.length; i += BATCH_SIZE) {
                            const batch = orderAndCashAmount.slice(i, i + BATCH_SIZE);
                            await Promise.all(batch.map(async (val, index) => {
                                // console.log(index, val)
                                const update = context.prisma.order.update({
                                    where: { id: index }, // Ensure val.id corresponds to your schema  
                                    data: { cost: val }, // Adjust data as necessary  
                                });
                            }));
                        }
                        console.log("Adjust OrderItems Complete!")
                    });


                return creation
            } catch (e) {
                console.log(e)
                handlePrismaError(e)
            }
        }
        else return throwUnauthorizedError()
    },
    importDutchieCustomer: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const results: any = []
            let customers: any = []
            // Replace 'path/to/your/file.csv' with the path to your CSV file
            try {
                await fs.createReadStream('./src/migration/dutchie/customers.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {
                        // console.log(results);
                        customers = results.map(customerRecord => {
                            return {
                                name: customerRecord.Fullname,
                                birthday: customerRecord.PatientDOB,
                                email: customerRecord.Email,
                                phone: customerRecord.Phone,
                                dispensaryId: _args.input.dispensaryId,
                                isActive: true,
                                driverLicense: customerRecord.DriversLicense,
                                driverLicenseExpirationDate: customerRecord.DriversLicenseExpiration,
                                isMedical: true,
                                medicalLicense: customerRecord.MJstateID,
                                medicalLicenseExpirationDate: customerRecord.StateIDexpiration,
                                loyaltyPoints: 0,
                                status: CustomerStatus.MEDICALMEMBER,
                                address: customerRecord.Address,
                                note: customerRecord.Notes,
                                city: customerRecord.City,
                                usState: customerRecord.State,
                                zipCode: customerRecord.Postalcode,
                            }
                        })
                        // console.log(results)
                        for (let i = 0; i < customers.length; i++) {
                            if (customers[i].name == '' || customers[i].medicalLicense == null) continue
                            const customerUpsert = await context.prisma.customer.upsert({
                                where: {
                                    dispensaryId_medicalLicense: {
                                        dispensaryId: _args.input.dispensaryId,
                                        medicalLicense: customers[i].medicalLicense,
                                    }
                                },
                                update: customers[i],
                                create: customers[i]
                            })
                        }

                        // const creation = await context.prisma.customer.createMany({
                        //     data: customers,
                        //     skipDuplicates: true
                        // });
                        console.log("Customer imported>>>>>", customers.length)
                    });
            } catch (e) {
                // console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    importDutchieCustomerLoyalty: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const results: any = []
            let customers: any = []
            // Replace 'path/to/your/file.csv' with the path to your CSV file
            try {
                await fs.createReadStream('./src/migration/dutchie/customerLoyalty.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {
                        // console.log(results);
                        customers = results.map(customerRecord => {
                            return {
                                customerName: customerRecord.CustomerName,
                                loyaltyPoint: customerRecord.LoyaltyPoint,
                            }
                        })
                        // console.log(results)
                        for (let i = 0; i < customers.length; i++) {
                            if (customers[i].customerName == '' || customers[i].loyaltyPoint == '') continue
                            const customerUpdate = await context.prisma.customer.updateMany({
                                where: {
                                    dispensaryId: _args.input.dispensaryId,
                                    name: customers[i].customerName
                                },
                                data: {
                                    loyaltyPoints: parseFloat(customers[i].loyaltyPoint)
                                }
                            })
                            console.log(customers[i].customerName, parseFloat(customers[i].loyaltyPoint))
                        }

                        // const creation = await context.prisma.customer.createMany({
                        //     data: customers,
                        //     skipDuplicates: true
                        // });
                        console.log("Customer imported>>>>>", customers.length)
                    });
            } catch (e) {
                // console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    importDutchieVendor: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const results: any = []
            let vendors: any = []
            // Replace 'path/to/your/file.csv' with the path to your CSV file
            try {
                await fs.createReadStream('./src/migration/dutchie/vendors.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {
                        // console.log(results);
                        vendors = results.map(vendorRecord => {
                            return {
                                Vendorname: vendorRecord.Vendorname,
                                Vendorcode: vendorRecord.Vendorcode,
                                Address: vendorRecord.Address,
                                City: vendorRecord.City,
                                Postalcode: vendorRecord.Postalcode,
                                State: vendorRecord.State,
                                Contactemail: vendorRecord.Contactemail,
                                Contactphone: vendorRecord.Contactphone,
                            }
                        })
                        // console.log(results)
                        for (let i = 0; i < vendors.length; i++) {
                            if (vendors[i].Vendorname == '') continue
                            const supplierUpsert = await context.prisma.supplier.upsert({
                                where: {
                                    organizationId_businessLicense: {
                                        organizationId: _args.input.organizationId,
                                        businessLicense: vendors[i].Vendorcode,
                                    }
                                },
                                update: {
                                    name: vendors[i].Vendorname,
                                    businessLicense: vendors[i].Vendorcode,
                                    phone: vendors[i].Contactphone,
                                    email: vendors[i].Contactemail,
                                    locationAddress: vendors[i].Address,
                                    locationCity: vendors[i].City,
                                    locationZipCode: vendors[i].Postalcode,
                                },
                                create: {
                                    organizationId: _args.input.organizationId,
                                    isActive: true,
                                    supplierType: SupplierType.Other,
                                    name: vendors[i].Vendorname,
                                    businessLicense: vendors[i].Vendorcode,
                                    phone: vendors[i].Contactphone,
                                    email: vendors[i].Contactemail,
                                    locationAddress: vendors[i].Address,
                                    locationCity: vendors[i].City,
                                    locationZipCode: vendors[i].Postalcode,
                                }
                            })
                            console.log(vendors[i].Vendorname, parseFloat(vendors[i].Vendorcode))
                        }

                        // const creation = await context.prisma.customer.createMany({
                        //     data: customers,
                        //     skipDuplicates: true
                        // });
                        console.log("Vendor imported>>>>>", vendors.length)
                    });
            } catch (e) {
                // console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
    importGrowflowSupplier: async (_parent, _args, context) => {
        if (context.role.includes(UserType.USER)) {
            const results: any = []
            let vendors: any = []
            // Replace 'path/to/your/file.csv' with the path to your CSV file
            try {
                await fs.createReadStream('./src/migration/growflow/suppliers.csv')
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', async () => {
                        // console.log(results);
                        vendors = results.map(vendorRecord => {
                            return {
                                Name: vendorRecord.Name,
                                LicenseNumber: vendorRecord.LicenseNumber,
                                Address: vendorRecord.Address,
                                Street: vendorRecord.Street,
                                Zip: vendorRecord.Zip,
                                City: vendorRecord.City,
                                Email: vendorRecord.Email,
                                Phone: vendorRecord.Phone,
                            }
                        })
                        // console.log(results)
                        for (let i = 0; i < vendors.length; i++) {
                            if (vendors[i].Vendorname == '' || vendors[i].Vendorcode == '') continue
                            const supplierUpsert = await context.prisma.supplier.upsert({
                                where: {
                                    organizationId_businessLicense: {
                                        organizationId: _args.input.organizationId,
                                        businessLicense: vendors[i].LicenseNumber,
                                    }
                                },
                                update: {
                                    name: vendors[i].Name,
                                    businessLicense: vendors[i].LicenseNumber,
                                    phone: vendors[i].Phone,
                                    email: vendors[i].Email,
                                    locationAddress: vendors[i].Address,
                                    locationCity: vendors[i].City,
                                    locationZipCode: vendors[i].Zip,
                                },
                                create: {
                                    organizationId: _args.input.organizationId,
                                    isActive: true,
                                    supplierType: SupplierType.Other,
                                    name: vendors[i].Name,
                                    businessLicense: vendors[i].LicenseNumber,
                                    phone: vendors[i].Phone,
                                    email: vendors[i].Email,
                                    locationAddress: vendors[i].Address,
                                    locationCity: vendors[i].City,
                                    locationZipCode: vendors[i].Zip,
                                }
                            })
                            console.log(vendors[i].Name, parseFloat(vendors[i].LicenseNumber))
                        }

                        // const creation = await context.prisma.customer.createMany({
                        //     data: customers,
                        //     skipDuplicates: true
                        // });
                        console.log("Vendor imported>>>>>", vendors.length)
                    });
            } catch (e) {
                // console.log("ff", e)
            }
            return {
                count: 0
            }
        }
        else return throwUnauthorizedError()
    },
} satisfies MutationResolvers