import { PackageStatus } from "@prisma/client"
import { Product } from "../resolvers/product"
import * as metrcModel from '../models/metrc'
import { handlePrismaError } from "../resolvers/mutation"
import { equal } from "joi"

export const getPackageById = async (context, id) => {
    return context.prisma.package.findUnique({
        where: { id: id || undefined },
        include: {
            assignPackage: {
                include: {
                    product: {
                        include: {
                            itemCategory: true,
                            supplier: true
                        }
                    }
                }
            },
            OrderItem: {
                orderBy: {
                    orderId: 'desc' // or 'desc' for descending order
                },
                include: {
                    order: true
                }
            },
            delivery: {
                include: {
                    transfer: {
                        include: {
                            supplier: true
                        }
                    }
                }
            },
            TestResult: true
        },
    })
}

export const getTotalTestResultByMetrcPackageId = async (context, args) => {

    const packageId = args.packageId
    const dispensaryId = args.dispensaryId

    console.log("packageId >>>> ", packageId)
    const testResultCount = await context.prisma.testResult.count({
        where: {
            packageId: packageId
        }
    });

    if (testResultCount === 0) {
        const fetchTestResult = await metrcModel.fetchTestResultByPackageId(context, dispensaryId, packageId)
        // console.log("fetchTestResult>>>>> ", fetchTestResult)

        const creation = await context.prisma.testResult.createMany({
            data: fetchTestResult,
            skipDuplicates: true
        })
    }

    const labTestData = await context.prisma.testResult.findMany({
        where: {
            packageId: packageId,
            testResultLevel: {
                gt: 0
            }
        },
        select: {
            testTypeName: true,
            testResultLevel: true,
        }
    })

    const resultOrder = {
        'THC': 1,
        'THCA': 2,
        'CBD': 3,
        'CBDA': 4,
        'CBN': 5,
        'Total Potential Psychoactive THC': 6
    };

    const result = labTestData.map(item => {
        let testTypeName = '';

        if (item.testTypeName.includes('THCA (%)')) {
            testTypeName = 'THCA';
        } else if (item.testTypeName.includes('CBDA (%)')) {
            testTypeName = 'CBDA';
        } else if (item.testTypeName.includes('Total THC (%)')) {
            testTypeName = 'Total Potential Psychoactive THC';
        } else if (item.testTypeName.includes('THC (%)')) {
            testTypeName = 'THC';
        } else if (item.testTypeName.includes('CBD (%)')) {
            testTypeName = 'CBD';
        } else if (item.testTypeName.includes('CBN (%)')) {
            testTypeName = 'CBN';
        }

        return {
            testTypeName,
            testResultLevel: item.testResultLevel,
        };
    });

    // Filter out any entries without a valid testTypeName (optional)
    const filteredResult = result.filter(r => r.testTypeName !== '');

    // Sort based on the specified order
    filteredResult.sort((a, b) => {
        return resultOrder[a.testTypeName] - resultOrder[b.testTypeName];
    });

    return filteredResult
}

export const getTotalTestResultByOrderId = async (context, args) => {
    const order = await context.prisma.order.findUnique({
        where: { id: args.orderId },
        include: {
            OrderItem: {
                include: {
                    package: true
                }
            },
        }
    })

    let resultData: any = []

    for (let i = 0; i < order.OrderItem.length; i++) {
        const packageData = order.OrderItem[i].package
        const params = {
            packageId: packageData.packageId,
            dispensaryId: args.dispensaryId
        }
        const testResult = await getTotalTestResultByMetrcPackageId(context, params)
        resultData.push(
            {
                packageId: packageData.packageId,
                labTest: testResult
            }
        )
    }

    let uniquePackages: any = [];
    const seenPackageIds = new Set();

    resultData.forEach(item => {
        if (!seenPackageIds.has(item.packageId)) {
            seenPackageIds.add(item.packageId);
            uniquePackages.push(item);
        }
    });
    return uniquePackages
}

export const getPackageByPackageId = async (context, packageId) => {
    return context.prisma.package.findUnique({
        where: { packageId: packageId || undefined },
    })
}

export const getPackageByLabel = async (context, label) => {
    return context.prisma.package.findUnique({
        where: { packageLabel: label || undefined },
        include: {
            assignPackage: {
                include: {
                    product: {
                        include: {
                            itemCategory: true,
                            supplier: true
                        }
                    }
                }
            },
            OrderItem: {
                orderBy: {
                    orderId: 'desc' // or 'desc' for descending order
                },
                include: {
                    order: true
                }
            },
            delivery: {
                include: {
                    transfer: {
                        include: {
                            supplier: true
                        }
                    }
                }
            },
            TestResult: true
        },
    })
}

export const getAllPackagesByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.package.findMany({
        where: { dispensaryId: dispensaryId || undefined },
        orderBy: { id: "asc" },
    })
}

export const getAllPendingAdjustedPackagesByDispensaryId = async (context, dispensaryId) => {
    const packages = await context.prisma.adjustPackage.findMany({
        where: {
            dispensaryId: dispensaryId,
            needMetrcSync: true,
            syncMetrc: false,
            package: {
                packageId: {
                    gt: 0,
                },
            }
        },
        include: {
            package: {
                include: {
                    assignPackage: {
                        include: {
                            product: {
                                include: {
                                    supplier: true
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: { id: "asc" },
    })

    return packages
}

export const getAllPackagesByDispensaryIdWithPages = async (context, args) => {
    let where: any = {
        dispensaryId: args.dispensaryId,
    };
    if (args.packageStatus !== 'all') {
        where.packageStatus = args.packageStatus
    }

    if (args.assignedStatus == 'incomplete') {
        where.assignPackage = null
    } else if (args.assignedStatus == 'complete') {
        where.isConnectedWithProduct = true
    }

    let orderBy: any
    const sortDirection = args.sortDirection ? args.sortDirection : 'asc'
    if (args.sortField) {
        switch (args.sortField) {
            case 'assignPackage.product.name':
                orderBy = { assignPackage: { product: { name: sortDirection } } }
                break

            case 'assignPackage.posQty':
                orderBy = { assignPackage: { posQty: sortDirection } }
                break

            case 'Quantity':
                orderBy = { Quantity: sortDirection }
                break

            case 'originalQty':
                orderBy = { originalQty: sortDirection }
                break

            case 'packageLabel':
                orderBy = { packageLabel: sortDirection }
                break

            case 'packageId':
                orderBy = { packageId: sortDirection }
                break

            case 'packageStatus':
                orderBy = { packageStatus: sortDirection }

                break
            case 'ReceivedDateTime':
                orderBy = { ReceivedDateTime: sortDirection }
                break
        }
    }
    if (args.searchField) {
        switch (args.searchField) {
            case 'assignPackage.product.name':
                if (args.searchParam) {
                    where.assignPackage = {
                        product: {
                            name: {
                                contains: args.searchParam,
                                mode: 'insensitive', // Optional: makes the search case-insensitive  
                            },
                        },
                    };
                }
                break;

            case 'packageLabel':
                if (args.searchParam) {
                    where.packageLabel = { // Assuming there is a field called 'label' in the package model  
                        contains: args.searchParam,
                        mode: 'insensitive',
                    };
                }
                break;

            case 'packageId':
                if (args.searchParam) {
                    where.packageId = parseInt(args.searchParam); // Assuming searchParam is the ID you're looking for  
                }
                break;

            case 'itemName':
                if (args.searchParam) {
                    where.itemName = { // Assuming there is a field called 'label' in the package model  
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
    console.log(where)
    const totalCount = await context.prisma.package.count({
        where: where
    });
    let searchedPackages
    try {
        searchedPackages = await context.prisma.package.findMany({
            include: {
                assignPackage: {
                    include: {
                        product: {
                            include: {
                                itemCategory: true
                            }
                        },
                    }
                }
            },
            where: where,
            orderBy: orderBy,
            skip: (args.pageNumber - 1) * args.onePageRecords,
            take: args.onePageRecords,
        })
        console.log("searchedPackages >>>>>>>>>>>> ", searchedPackages)
    } catch (error) {
        console.log(error)
        handlePrismaError(error)
    }

    return {
        packages: searchedPackages,
        totalCount: totalCount
    }
}

export const getAuditDiscrepancyPackages = async (context, args) => {
    let where: any = {
        dispensaryId: args.dispensaryId,
    };
    where.packageId = {
        gt: 0
    }
    where.packageStatus = PackageStatus.ACTIVE
    where.isConnectedWithProduct = true

    where.Quantity = {
        not: {
            equals: context.prisma.package.fields.posQty
        }
    }

    let orderBy: any
    const sortDirection = args.sortDirection ? args.sortDirection : 'asc'
    if (args.sortField) {
        switch (args.sortField) {
            case 'assignPackage.product.name':
                orderBy = { assignPackage: { product: { name: sortDirection } } }
                break

            case 'assignPackage.posQty':
                orderBy = { assignPackage: { posQty: sortDirection } }
                break

            case 'Quantity':
                orderBy = { Quantity: sortDirection }
                break

            case 'originalQty':
                orderBy = { originalQty: sortDirection }
                break

            case 'packageLabel':
                orderBy = { packageLabel: sortDirection }
                break

            case 'packageId':
                orderBy = { packageId: sortDirection }
                break

            case 'packageStatus':
                orderBy = { packageStatus: sortDirection }

                break
            case 'ReceivedDateTime':
                orderBy = { ReceivedDateTime: sortDirection }
                break
        }
    }
    if (args.searchField) {
        switch (args.searchField) {
            case 'assignPackage.product.name':
                if (args.searchParam) {
                    where.assignPackage = {
                        product: {
                            name: {
                                contains: args.searchParam,
                                mode: 'insensitive', // Optional: makes the search case-insensitive  
                            },
                        },
                    };
                }
                break;

            case 'packageLabel':
                if (args.searchParam) {
                    where.packageLabel = { // Assuming there is a field called 'label' in the package model  
                        contains: args.searchParam,
                        mode: 'insensitive',
                    };
                }
                break;

            case 'packageId':
                if (args.searchParam) {
                    where.packageId = parseInt(args.searchParam); // Assuming searchParam is the ID you're looking for  
                }
                break;

            case 'itemName':
                if (args.searchParam) {
                    where.itemName = { // Assuming there is a field called 'label' in the package model  
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
    console.log(where)
    const totalCount = await context.prisma.package.count({
        where: where
    });
    let searchedPackages
    try {
        searchedPackages = await context.prisma.package.findMany({
            include: {
                assignPackage: {
                    include: {
                        product: {
                            include: {
                                itemCategory: true
                            }
                        },
                    }
                }
                // assignPackage: true
            },
            where: where,
            orderBy: orderBy,
            skip: (args.pageNumber - 1) * args.onePageRecords,
            take: args.onePageRecords,
        })
    } catch (error) {
        console.log(error)
        handlePrismaError(error)
    }

    return {
        packages: searchedPackages,
        totalCount: totalCount
    }
}

export const getPackagesByDispensaryIdAndStatus = async (context, args) => {
    return context.prisma.package.findMany({
        where: {
            dispensaryId: args.dispensaryId,
            packageStatus: args.status
        },
        orderBy: { id: "asc" },
    })
}

export const getPackageRowsByItemSearch = async (context, args) => {
    return context.prisma.package.findMany({
        where: {
            dispensaryId: args.dispensaryId,  // Replace with the actual dispensaryId variable
            itemName: {
                contains: args.searchQuery,        // Replace with the actual itemName variable
                mode: 'insensitive',        // Optional: makes the search case insensitive
            },
        },
        orderBy: { id: "asc" },
        take: 10,
    })
}

export const getPackagesByDeliveryId = async (context, args) => {
    return context.prisma.deliveryPackages.findMany({
        where: {
            deliveryId: args.deliveryId,
        },
        orderBy: { id: "asc" },
        include: {
            package: {
                include: {
                    assignPackage: {
                        include: {
                            product: true
                        }
                    }
                }
            }
        }
    })
}

export const getZeroMetrcQtyPackagesByDispensaryId = async (context, args) => {
    let where: any = {
        dispensaryId: args.dispensaryId,
        packageStatus: PackageStatus.ACTIVE,
        Quantity: 0,
        assignPackage: {
            posQty: 0
        }
    }

    let orderBy: any = { assignPackage: { product: { name: 'asc' } } }
    const sortDirection = args.sortDirection ? args.sortDirection : 'asc'
    if (args.sortField) {
        switch (args.sortField) {
            case 'packageLabel':
                orderBy = { packageLabel: sortDirection }
                break
            case 'packageId':
                orderBy = { packageId: sortDirection }
                break
            case 'assignPackage.product.name':
                orderBy = { assignPackage: { product: { name: sortDirection } } }
                break
            case 'assignPackage.posQty':
                orderBy = { assignPackage: { posQty: sortDirection } }
                break
            case 'assignPackage.cost':
                orderBy = { assignPackage: { cost: sortDirection } }
                break
            case 'packageStatus':
                orderBy = { packageStatus: sortDirection }
                break
            case 'Quantity':
                orderBy = { Quantity: sortDirection }
                break
            case 'createdAt':
                orderBy = { createdAt: sortDirection }
                break
        }
    }

    if (args.searchField) {
        switch (args.searchField) {
            case 'metrcType':
                if (args.searchParam) {
                    if (args.searchParam === 'MJ') {
                        where.packageId = {
                            gt: 0,
                        }
                    }
                    if (args.searchParam === 'NMJ') {
                        where.packageId = null
                    }
                }
                break;
            case 'packageId':
                if (args.searchParam) {
                    if (Number(args.searchParam) > 0)
                        where.packageId = Number(args.searchParam)
                }
                break;
            case 'assignPackage.product.name':
                if (args.searchParam) {
                    where.assignPackage = {
                        product: {
                            name: {
                                contains: args.searchParam,
                                mode: 'insensitive',
                            }
                        }
                    };
                }
                break;
            case 'packageLabel':
                if (args.searchParam) {
                    where.packageLabel = {
                        contains: args.searchParam,
                        mode: 'insensitive',
                    };
                }
                break;
            default:
                break; // Do nothing if searchField doesn't match any case  
        }
    }

    const totalCount = await context.prisma.package.count({
        where: where
    });
    const searchedPackages = await context.prisma.package.findMany({
        include: {
            assignPackage: {
                include: {
                    product: true
                }
            }
        },
        where: where,
        orderBy: orderBy,
        skip: (args.pageNumber - 1) * args.onePageRecords,
        take: args.onePageRecords,
    })
    return {
        packages: searchedPackages,
        totalCount: totalCount
    }
}

export const getTinyMetrcQtyPackagesByDispensaryId = async (context, args) => {
    let where: any = {
        dispensaryId: args.dispensaryId,
        packageStatus: PackageStatus.ACTIVE,
        Quantity: {
            gt: 0,
            lt: 1
        },
        assignPackage: {
            posQty: {
                gt: 0,
                lt: 1
            }
        }
    }

    let orderBy: any = { assignPackage: { product: { name: 'asc' } } }
    const sortDirection = args.sortDirection ? args.sortDirection : 'asc'
    if (args.sortField) {
        switch (args.sortField) {
            case 'packageLabel':
                orderBy = { packageLabel: sortDirection }
                break
            case 'packageId':
                orderBy = { packageId: sortDirection }
                break
            case 'assignPackage.product.name':
                orderBy = { assignPackage: { product: { name: sortDirection } } }
                break
            case 'assignPackage.posQty':
                orderBy = { assignPackage: { posQty: sortDirection } }
                break
            case 'assignPackage.cost':
                orderBy = { assignPackage: { cost: sortDirection } }
                break
            case 'packageStatus':
                orderBy = { packageStatus: sortDirection }
                break
            case 'Quantity':
                orderBy = { Quantity: sortDirection }
                break
            case 'createdAt':
                orderBy = { createdAt: sortDirection }
                break
        }
    }

    if (args.searchField) {
        switch (args.searchField) {
            case 'metrcType':
                if (args.searchParam) {
                    if (args.searchParam === 'MJ') {
                        where.packageId = {
                            gt: 0,
                        }
                    }
                    if (args.searchParam === 'NMJ') {
                        where.packageId = null
                    }
                }
                break;
            case 'packageId':
                if (args.searchParam) {
                    if (Number(args.searchParam) > 0)
                        where.packageId = Number(args.searchParam)
                }
                break;
            case 'assignPackage.product.name':
                if (args.searchParam) {
                    where.assignPackage = {
                        product: {
                            name: {
                                contains: args.searchParam,
                                mode: 'insensitive',
                            }
                        }
                    };
                }
                break;
            case 'packageLabel':
                if (args.searchParam) {
                    where.packageLabel = {
                        contains: args.searchParam,
                        mode: 'insensitive',
                    };
                }
                break;
            default:
                break; // Do nothing if searchField doesn't match any case  
        }
    }

    const totalCount = await context.prisma.package.count({
        where: where
    });
    const searchedPackages = await context.prisma.package.findMany({
        include: {
            assignPackage: {
                include: {
                    product: true
                }
            }
        },
        where: where,
        orderBy: orderBy,
        skip: (args.pageNumber - 1) * args.onePageRecords,
        take: args.onePageRecords,
    })
    return {
        packages: searchedPackages,
        totalCount: totalCount
    }
}

export const getProductAndPackagesByNameSearch = async (context, args) => {
    let result
    let where: any = {
        dispensaryId: args.dispensaryId,
        OR: [
            {
                product: {
                    name: {
                        contains: args.searchQuery,
                        mode: 'insensitive',
                    },
                }
            },
            {
                packageLabel: {
                    contains: args.searchQuery,
                    mode: 'insensitive',
                },
            }
        ],
        package: {
            packageStatus: PackageStatus.ACTIVE
        }
    }
    if (args.itemCategoryId != 'all') {
        where.product = {
            itemCategoryId: args.itemCategoryId
        }
    }
    try {
        result = await context.prisma.assignPackage.findMany({
            where: where,
            include: {
                product: {
                    include: {
                        itemCategory: true
                    }
                },
                package: {
                    select: {
                        packageId: true,
                        packageStatus: true,
                        UnitOfMeasureName: true
                    }
                }
            },
            orderBy: [
                {
                    product: {
                        name: "asc"
                    },

                },
                { createdAt: "asc" }
            ],
            skip: (args.pageNumber - 1) * args.onePageRecords,
            take: args.onePageRecords,
        })
    } catch (e) {
        console.log("error>>>", e)
        // handlePrismaError(e)
    }

    return result
}

export const getPackagesByConnectedProductId = async (context, args) => {
    return context.prisma.package.findMany({
        where: {
            assignPackage: {
                productId: args.productId,
            }
        },
        include: {
            assignPackage: {
                include: {
                    product: {
                        include: {
                            itemCategory: true,
                            supplier: true
                        }
                    }
                }
            },
            delivery: {
                include: {
                    transfer: {
                        include: {
                            supplier: true
                        }
                    }
                }
            }
        },
        orderBy: { id: "asc" },
    })
}

export const getNonMjPackagesByTransferId = async (context, args) => {
    return context.prisma.package.findMany({
        where: {
            nonMjTransferId: args.transferId,
        },
        include: {
            assignPackage: true,
            product: {
                include: {
                    itemCategory: true
                }
            }
        },
        orderBy: { id: "asc" },
    })
}
