import { TransferStatus } from "@prisma/client"

export const getTransfersByDispensaryIdAndTransferTypeAndStatus = async (context, args) => {
    return context.prisma.transfer.findMany({
        include: {
            user: true
        },
        where: {
            dispensaryId: args.dispensaryId,
            ...(args.transferType && {
                transferType: args.transferType, // Only include if transferType is provided
            }),
            ...(args.status && {
                status: args.status, // Only include if status is provided
            }),
        },
        orderBy: { createdAt: 'desc' },
    })
}
export const getTransfersByDispensaryIdAndTransferTypeAndStatusWithPages = async (context, args) => {
    let where: any = {
        dispensaryId: args.dispensaryId,
        status: {
            not: TransferStatus.PENDING
        }
    }
    if (args.transferType) where.transferType = args.transferType
    // if (args.status == 'pending') where.status = TransferStatus.PENDING
    
    if (args.mjType == 'mj'){
        where.transferId = {
            gt: 0
        }
    }
    if (args.mjType == 'nmj'){
        where.transferId = null
    }
    
    if(args.status == 'complete'){
        if(args.mjType == ''){
            where.OR = [
                {
                    transferId : {
                        gt: 0
                    },
                    ReceivedPackageCount : {
                        gt: 0,
                        equals: context.prisma.transfer.fields.assignedPackageCount
                    }
                },
                {
                    transferId : null,
                    assignedPackageCount : {
                        gt: 0,
                    }
                }
            ]
        }
        if(args.mjType == 'mj'){
            where.ReceivedPackageCount = {
                gt: 0,
                equals: context.prisma.transfer.fields.assignedPackageCount
            }
        }
        if(args.mjType == 'nmj'){
            where.assignedPackageCount = {
                gt: 0,
            }
        }
    }
    if(args.status == 'incomplete'){
        if(args.mjType == ''){
            where.OR = [
                {
                    transferId : {
                        gt: 0
                    },
                    ReceivedPackageCount : {
                        gt: context.prisma.transfer.fields.assignedPackageCount
                    }
                },
                {
                    transferId : null,
                    assignedPackageCount : 0
                }
            ]
        }

        if(args.mjType == 'mj'){
            where.ReceivedPackageCount = {
                gt: context.prisma.transfer.fields.assignedPackageCount
            }
        }
        if(args.mjType == 'nmj'){
            where.assignedPackageCount = 0
        }
    }

    let orderBy: any = { ReceivedDateTime: 'desc' }
    const sortDirection = args.sortDirection ? args.sortDirection : 'asc'
    if (args.sortField) {
        switch (args.sortField) {
            case 'updatedAt':
                orderBy = { updatedAt: sortDirection }
                break
            case 'transferType':
                orderBy = { transferType: sortDirection }
                break
            case 'status':
                orderBy = { status: sortDirection }
                break
            case 'ShipperFacilityName':
                orderBy = { ShipperFacilityName: sortDirection }
                break
            case 'CreatedDateTime':
                orderBy = { CreatedDateTime: sortDirection }
                break
            case 'ShipperFacilityName':
                orderBy = { ShipperFacilityName: sortDirection }
                break
            case 'transferId':
                orderBy = { transferId: sortDirection }
                break
            case 'PackageCount':
                orderBy = { PackageCount: sortDirection }
                break
            case 'ReceivedDateTime':
                orderBy = { ReceivedDateTime: sortDirection }
                break
            case 'ReceivedPackageCount':
                orderBy = { ReceivedPackageCount: sortDirection }
                break
            case 'assignedPackageCount':
                orderBy = { assignedPackageCount: sortDirection }
                break
            case 'ShipperFacilityLicenseNumber':
                orderBy = { ShipperFacilityLicenseNumber: sortDirection }
                break
            case 'deliveryId':
                orderBy = { deliveryId: sortDirection }
                break
            case 'isMJ':
                orderBy = { isMJ: sortDirection }
                break
        }
    }

    if (args.searchField) {
        switch (args.searchField) {
            case 'metrcId':
                if (args.searchParam) {
                    where.transferId = parseInt(args.searchParam); // Assuming searchParam is the ID you're looking for  
                }
                break;

            case 'deliveryId':
                if (args.searchParam) {
                    where.deliveryId = parseInt(args.searchParam); // Assuming searchParam is the ID you're looking for  
                }
                break;

            case 'ShipperFacilityName':
                if (args.searchParam) {
                    where.ShipperFacilityName = { // Assuming there is a field called 'label' in the package model  
                        contains: args.searchParam,
                        mode: 'insensitive',
                    };
                }
                break;

            // You can add more cases here for additional searchField values.  

            default:
                break; // Do nothing if searchField doesn't match any case  
        }
    }

    const totalCount = await context.prisma.transfer.count({
        where: where
    });
    console.log("where>>>>>> ", where)
    const searchedTransfers = await context.prisma.transfer.findMany({
        orderBy: orderBy,
        where: where,
        include: {
            supplier: true,
            DeliveryPackages: true,
        },
        skip: (args.pageNumber - 1) * args.onePageRecords,
        take: args.onePageRecords,
    })
    return {
        transfers: searchedTransfers,
        totalCount: totalCount
    }
}

export const getTransferById = async (context, args) => {
    return context.prisma.transfer.findUnique({
        include: {
            user: true,
            supplier: true
        },
        where: {
            id: args.id
        },
    })
}
