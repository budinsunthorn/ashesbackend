import { Dispensary } from "../resolvers/dispensary"

export const getProductById = async (context, id) => {
    return context.prisma.product.findUnique({
        where: { id: id || undefined },
        include: {
            dispensary: true,
            user: true,
            supplier: true,
            itemCategory: true,
        }
    })
}

export const getAllProductsByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.product.findMany({
        include: {
            dispensary: true,
            user: true,
            supplier: true,
            itemCategory: true,
        },
        where: { dispensaryId: dispensaryId || undefined },
        orderBy: { id: "asc" },
    })
}

export const getProductRowsByNameSearch = async (context, args) => {
    return context.prisma.product.findMany({
        where: {
            dispensaryId: args.dispensaryId,  // Replace with the actual dispensaryId variable
            name: {
                contains: args.searchQuery,        // Replace with the actual itemName variable
                mode: 'insensitive',        // Optional: makes the search case insensitive
            },
        },
        include: {
            itemCategory: true
        },
        orderBy: { id: "asc" },
        take: 10,
    })
}

export const getMjProductRowsByNameSearch = async (context, args) => {
    return context.prisma.product.findMany({
        where: {
            dispensaryId: args.dispensaryId,
            name: {
                contains: args.searchQuery,
                mode: 'insensitive',
            },
            itemCategory: {
                containMj: true, // Filter for itemCategory.containMJ being false
            },
        },
        include: {
            itemCategory: true
        },
        orderBy: { id: "asc" },
        take: 10,
    })
}

export const getNonMjProductRowsByNameSearch = async (context, args) => {
    return context.prisma.product.findMany({
        where: {
            dispensaryId: args.dispensaryId,
            name: {
                contains: args.searchQuery,
                mode: 'insensitive',
            },
            itemCategory: {
                containMj: false, // Filter for itemCategory.containMJ being false
            },
        },
        include: {
            itemCategory: true
        },
        orderBy: { id: "asc" },
        take: 10,
    })
}

export const getTopProductsForCustomerByDispensaryId = async (context, args) => {
    try {
        const result = await context.prisma.orderItem.groupBy({
            by: ['productId'],
            // where: {  
            //   order: {  
            //     customerId: "cm4oaun9800w08e7lgaodkdx5",  
            //   },  
            // },  
            _sum: {
                quantity: true,
            },
            include: {
                product: {
                    include: {
                        itemCategory: true,
                    },
                },
            },
        });

        // Map the results to include category names and product names
        const formattedResult = result.map(item => ({
            category: item.product.itemCategory.name,
            name: item.product.name,
            count: item._sum.quantity,
        }));
    } catch (e) {
        console.log(e)
    }


    return [];

    // Transform the result to get the desired format
    //   const result = topProducts.map(item => ({
    //     category: item.product.itemCategory.name,
    //     name: item.product.name,
    //     count: item._sum.quantity || 0, // Use 0 if null
    //   }));

    //   console.log(result);
}

export const getAllProductsByDispensaryIdWithPages = async (context, args) => {
    let where: any = {
        dispensaryId: args.dispensaryId,
    };
    let orderBy: any = { id: 'asc' }
    const sortDirection = args.sortDirection ? args.sortDirection : 'asc'
    if (args.searchField) {
        switch (args.searchField) {
            case 'name':
                if (args.searchParam) {
                    where.name = {
                        contains: args.searchParam,
                        mode: 'insensitive', // Optional: makes the search case-insensitive  
                    };
                }
                break;

            case 'supplier.name':
                if (args.searchParam) {
                    where.supplier = {
                        name: {
                            contains: args.searchParam,
                            mode: 'insensitive', // Optional: makes the search case-insensitive  
                        }
                    };
                }
                break;

            // You can add more cases here for additional searchField values.  

            default:
                break; // Do nothing if searchField doesn't match any case  
        }
    }
    if (args.sortField) {
        switch (args.sortField) {
            case 'itemCategory.name':
                orderBy = { itemCategory: { name: sortDirection } }
                break

            case 'supplier.name':
                orderBy = { supplier: { name: sortDirection } }
                break

            case 'sku':
                orderBy = { sku: sortDirection }
                break

            case 'upc':
                orderBy = { upc: sortDirection }
                break

            case 'unitWeight':
                orderBy = { unitWeight: sortDirection }
                break

            case 'netWeight':
                orderBy = { netWeight: sortDirection }
                break

            case 'price':
                orderBy = { price: sortDirection }

                break
            case 'createdAt':
                orderBy = { createdAt: sortDirection }
                break
        }
    }

    if (args.categoryType !== 'all') {
        where.itemCategoryId = args.categoryType
    }

    // if (args.howStock) {
    //     switch (args.howStock) {
    //         case 'has':
    //             where.AssignPackage = {
    //                 posQty: { gt: 0 }
    //             }
    //             break;

    //         case 'negative':
    //             where.AssignPackage = {
    //                 posQty: { lt: 0 }
    //             }
    //             break;

    //         case 'no':
    //             where.AssignPackage = {
    //                 posQty: 0
    //             }
    //             break;

    //         default: break;
    //     }
    // }

    const totalCount = await context.prisma.product.count({
        where: where
    });
    const searchedProducts = await context.prisma.product.findMany({
        where: where,
        orderBy: orderBy,
        include: {
            dispensary: true,
            user: true,
            supplier: true,
            itemCategory: true,
            AssignPackage: true
        },
        skip: (args.pageNumber - 1) * args.onePageRecords,
        take: args.onePageRecords,
    })

    console.log("searchedProducts >>>>>>>> ", searchedProducts)
    const productsWithPosQtySum = searchedProducts.map(product => {
        const posQtySum = product.AssignPackage.reduce((sum, pkg) => sum + pkg.posQty, 0) || 0;
        return {
            ...product,
            posQtySum,
        };
    });
    let fetchingResult: any = productsWithPosQtySum

    // if(args.sortField === 'posQtySum') fetchingResult = fetchingResult.sort((a, b) => b.posQtySum - a.posQtySum);
    return {
        products: fetchingResult,
        totalCount: totalCount
    }
}