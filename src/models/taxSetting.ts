import { truncateToTwoDecimals } from "../context";

export const getTaxSetting = async (context, id) => {
    return context.prisma.taxSetting.findUnique({
        where: { id: id || undefined },
    })
}

export const getTaxSettingByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.taxSetting.findMany({
        where: { dispensaryId: dispensaryId || undefined },
        orderBy: { id: "asc" },
    })
}

export const getTaxSettingByDispensaryIdAndApplyTo = async (context, dispensaryId, applyTo) => {
    return context.prisma.taxSetting.findMany({
        where: {
            dispensaryId: dispensaryId,
            OR: [
                { applyTo: "ALL" },
                { applyTo: applyTo },
            ]
        },
        orderBy: { id: "asc" },
    })
}

export const getAllTaxApplyByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.taxApply.findMany({
        where: { dispensaryId: dispensaryId || undefined },
        orderBy: { id: "asc" },
    })
}

export const calculateCompoundedTaxPercent = async (taxArray, applyTo) => {

    let taxPercentSum = 0

    // Function to apply a tax
    const calculateTaxes = (productPrice, taxes) => {
        console.log("taxes>>>>>>", taxes)
        let taxValues = {};

        const calculateTax = (taxId) => {
            // If the tax is already calculated, return its value
            if (taxValues[taxId] !== undefined) {
                return taxValues[taxId];
            }

            // Find the tax in the taxes array
            const tax = taxes[taxId]
            if (!tax) {
                // throw new Error(`Tax ${taxId} not found`);
                console.log(`Tax ${taxId} not found`)
                return 0
            }

            let taxValue = 0;

            // If it's a standard tax, calculate it directly
            if (tax.compoundTaxes && tax.compoundTaxes.length === 0) {
                taxValue = productPrice * tax.rate / 100;
            } else if (tax.compoundTaxes.length > 0) {
                // Calculate the base for the compound tax
                let baseAmount = productPrice;
                // Add the values of all taxes that are included in this compound tax
                for (let includedTaxId of tax.compoundTaxes) {
                    baseAmount += calculateTax(includedTaxId);
                }
                // Calculate the compound tax
                taxValue = baseAmount * tax.rate / 100;
            }

            taxValues[taxId] = taxValue;
            return taxValue;
        }

        let compoundTaxes: any = []
        Object.keys(taxes).forEach(taxId => {
            let taxValue = calculateTax(taxes[taxId].id);
            taxPercentSum += taxValue
            let taxJson = {
                dispensaryId: taxes[taxId].dispensaryId,
                applyTo: applyTo,
                taxName: taxes[taxId].name,
                basePercent: taxes[taxId].rate,
                isTaxExempt: taxes[taxId].isExcludeFromTaxExempt,
                compoundPercent: taxValues[taxId],
            }
            compoundTaxes.push(taxJson)
            // taxValues[taxId] = taxJson
        })

        if (compoundTaxes.length > 0 && taxPercentSum > 0) {
            compoundTaxes = compoundTaxes.map(({ compoundPercent, ...data }) => ({
                ...data,
                compoundPercent: 100 / (100 + taxPercentSum) * compoundPercent
            }))
        }
        return compoundTaxes;
    }


    const productPrice = 100;
    const taxValues = calculateTaxes(productPrice, taxArray);
    return taxValues
}

export const updateTaxApply = async (context, dispensaryId, applyTo) => {

    context.prisma.$transaction(async (tx) => {

        // Update taxApply data for current dispensary
        const taxSettings: any = await getTaxSettingByDispensaryIdAndApplyTo(context, dispensaryId, applyTo)
        const taxArray: { [key: string]: any } = {}
        taxSettings.forEach((t: any) => {
            taxArray[t.id] = t;
        });
        console.log("taxArray>>>>>>>>>> ", taxArray)
        const compoundedTaxPercentages = await calculateCompoundedTaxPercent(taxArray, applyTo);

        console.log("compoundedTaxPercentages>>>>>>>>>> ", compoundedTaxPercentages)
        const deleteTaxApply = await tx.taxApply.deleteMany({
            where: {
                dispensaryId: dispensaryId,
                applyTo: applyTo
            }
        })

        const createNewTaxApply = await tx.taxApply.createMany({
            data: compoundedTaxPercentages
        })
    })

}

