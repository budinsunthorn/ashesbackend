
const { base64encode, base64decode } = require('nodejs-base64');
import fetch from 'node-fetch';
import dotenv from "dotenv";
import { OrderMjType, OrderType, OrderStatus, PackageStatus, TransferType, TransferStatus } from "@prisma/client";
import { truncateToTwoDecimals, setFourDecimals, getFiveMinutesBeforeInISOStyle } from "../context";
import { endPoints } from "../context";
import * as orderModel from '../models/order'
const moment = require('moment-timezone');

const stateTimezones = {
    AL: 'America/Chicago',      // Alabama - Central Time  
    AK: 'America/Anchorage',    // Alaska  
    AZ: 'America/Phoenix',      // Arizona (no DST)  
    AR: 'America/Chicago',      // Arkansas  
    CA: 'America/Los_Angeles',  // California  
    CO: 'America/Denver',       // Colorado  
    CT: 'America/New_York',     // Connecticut  
    DE: 'America/New_York',     // Delaware  
    FL: 'America/New_York',     // Florida - mostly Eastern Time (some panhandle areas are Central, simplified here)  
    GA: 'America/New_York',
    HI: 'Pacific/Honolulu',     // Hawaii  
    ID: 'America/Denver',       // Idaho mostly Mountain Time (some parts Pacific)  
    IL: 'America/Chicago',
    IN: 'America/New_York',     // Indiana mostly Eastern Time (some parts Central)  
    IA: 'America/Chicago',
    KS: 'America/Chicago',      // Kansas mostly Central Time (some parts Mountain)  
    KY: 'America/New_York',     // Kentucky mostly Eastern Time (some parts Central)  
    LA: 'America/Chicago',
    ME: 'America/New_York',
    MD: 'America/New_York',
    MA: 'America/New_York',
    MI: 'America/New_York',     // Michigan mostly Eastern Time (some parts Central)  
    MN: 'America/Chicago',
    MS: 'America/Chicago',
    MO: 'America/Chicago',
    MT: 'America/Denver',
    NE: 'America/Chicago',      // Nebraska mostly Central Time (some parts Mountain)  
    NV: 'America/Los_Angeles',  // Nevada mostly Pacific (some parts Mountain)  
    NH: 'America/New_York',
    NJ: 'America/New_York',
    NM: 'America/Denver',
    NY: 'America/New_York',
    NC: 'America/New_York',
    ND: 'America/Chicago',      // North Dakota mostly Central Time (some parts Mountain)  
    OH: 'America/New_York',
    OK: 'America/Chicago',
    OR: 'America/Los_Angeles',  // Oregon mostly Pacific (some parts Mountain)  
    PA: 'America/New_York',
    RI: 'America/New_York',
    SC: 'America/New_York',
    SD: 'America/Chicago',      // South Dakota mostly Central Time (some parts Mountain)  
    TN: 'America/Chicago',      // Tennessee mostly Central Time (some parts Eastern)  
    TX: 'America/Chicago',      // Texas mostly Central Time (some parts Mountain)  
    UT: 'America/Denver',
    VT: 'America/New_York',
    VA: 'America/New_York',
    WA: 'America/Los_Angeles',
    WV: 'America/New_York',
    WI: 'America/Chicago',
    WY: 'America/Denver',
};

dotenv.config()

export function convertUtcToStateTz(inputUtc, locationState) {
    const tz = stateTimezones[locationState];
    if (!tz) throw new Error(`Unknown timezone for state: ${locationState}`);

    // Convert from UTC to target TZ and format
    return moment.utc(inputUtc).tz(tz).format('YYYY-MM-DDTHH:mm:ss.SSS');
}

// const metrcApiEndpoint = 'https://api-ok.metrc.com/'
const vendor_key = process.env.METRC_MODE == 'sandbox' ? process.env.SANDBOX_VENDOR_KEY : process.env.VENDOR_KEY
const defaultLastModifiedStart = "1990-01-17T06:30:00Z"
const lastModifiedEnd = "2099-01-17T06:30:00Z"
const pageNumber = 1
const pageSize = 20

export const getMetrcInfoByDispensaryId = async (context, id) => {
    return context.prisma.dispensary.findUnique({
        where: {
            id: id,
            metrcConnectionStatus: true
        },
        select: {
            metrcConnectionStatus: true,
            metrcApiKey: true,
            cannabisLicense: true,
            locationState: true,
            id: true
        },
    })
}

export const getMetrcAdjustmentReasonsData = async (_args, context) => {

    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]
    // console.log("Metrc >>>", metrcApiEndpoint + 'items/v2/categories?licenseNumber=' + cannabisLicense)
    const response = await fetch(metrcApiEndpoint + 'packages/v2/adjust/reasons?licenseNumber=' + cannabisLicense, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        }
    });
    const jsonData = await response.json()
    const metrcAdjustmentReasonsData = jsonData.Data

    // const metrcDataInput = await metrcCategoryData.map(data => ({
    //     ...data,
    //     dispensaryId: _args.input.dispensaryId
    // }));

    const metrcDataInput = await metrcAdjustmentReasonsData.map(adjustmentReason => {
        return {
            dispensaryId: _args.input.dispensaryId,
            Name: adjustmentReason.Name,
            RequiresNote: adjustmentReason.RequiresNote,
            RequiresWasteWeight: adjustmentReason.RequiresWasteWeight,
            RequiresImmatureWasteWeight: adjustmentReason.RequiresImmatureWasteWeight,
            RequiresMatureWasteWeight: adjustmentReason.RequiresMatureWasteWeight,
        }
    })

    return metrcDataInput
}

export const getMetrcItemCategoryData = async (_args, context) => {

    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    // console.log("Metrc >>>", metrcApiEndpoint + 'items/v2/categories?licenseNumber=' + cannabisLicense)
    const response = await fetch(metrcApiEndpoint + 'items/v2/categories?licenseNumber=' + cannabisLicense, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        }
    });
    const jsonData = await response.json()

    const metrcCategoryData = jsonData.Data

    // const metrcDataInput = await metrcCategoryData.map(data => ({
    //     ...data,
    //     dispensaryId: _args.input.dispensaryId
    // }));

    const metrcDataInput = await metrcCategoryData.map(metrcCategory => {
        return {
            dispensaryId: _args.input.dispensaryId,
            Name: metrcCategory.Name,
            ProductCategoryType: metrcCategory.ProductCategoryType,
            QuantityType: metrcCategory.QuantityType,
            RequiresStrain: metrcCategory.RequiresStrain,
            RequiresItemBrand: metrcCategory.RequiresItemBrand,
            RequiresAdministrationMethod: metrcCategory.RequiresAdministrationMethod,
            RequiresUnitCbdPercent: metrcCategory.RequiresUnitCbdPercent,
            RequiresUnitCbdContent: metrcCategory.RequiresUnitCbdContent,
            RequiresUnitCbdContentDose: metrcCategory.RequiresUnitCbdContentDose,
            RequiresUnitThcPercent: metrcCategory.RequiresUnitThcPercent,
            RequiresUnitThcContent: metrcCategory.RequiresUnitThcContent,
            RequiresUnitThcContentDose: metrcCategory.RequiresUnitThcContentDose,
            RequiresUnitVolume: metrcCategory.RequiresUnitVolume,
            RequiresUnitWeight: metrcCategory.RequiresUnitWeight,
            RequiresServingSize: metrcCategory.RequiresServingSize,
            RequiresSupplyDurationDays: metrcCategory.RequiresSupplyDurationDays,
            RequiresNumberOfDoses: metrcCategory.RequiresNumberOfDoses,
            RequiresPublicIngredients: metrcCategory.RequiresPublicIngredients,
            RequiresDescription: metrcCategory.RequiresDescription,
            RequiresAllergens: metrcCategory.RequiresAllergens,
            RequiresProductPhotos: metrcCategory.RequiresProductPhotos,
            RequiresProductPhotoDescription: metrcCategory.RequiresProductPhotoDescription,
            RequiresLabelPhotos: metrcCategory.RequiresLabelPhotos,
            RequiresLabelPhotoDescription: metrcCategory.RequiresLabelPhotoDescription,
            RequiresPackagingPhotos: metrcCategory.RequiresPackagingPhotos,
            RequiresPackagingPhotoDescription: metrcCategory.RequiresPackagingPhotoDescription,
            CanContainSeeds: metrcCategory.CanContainSeeds,
            CanBeRemediated: metrcCategory.CanBeRemediated,
            CanBeDecontaminated: metrcCategory.CanBeDecontaminated,
            CanBeDestroyed: metrcCategory.CanBeDestroyed,
            RequiresProductPDFDocuments: metrcCategory.RequiresProductPDFDocuments,
            LabTestBatchNames: metrcCategory.LabTestBatchNames,
        }
    })

    return metrcDataInput
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const getMetrcReceiptByIdDataByParams = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, receiptId) => {
    let jsonData
    let retries = 10
    while (retries) {
        console.log(metrcApiEndpoint + 'sales/v2/receipts/' + receiptId + '?licenseNumber=' + cannabisLicense)
        const response = await fetch(metrcApiEndpoint + 'sales/v2/receipts/' + receiptId + '?licenseNumber=' + cannabisLicense, {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
            }
        });
        if (response.status === 429) {
            console.log("Too Many Requests", retries)
            await sleep(2000 * (11 - retries));
            retries--;
        }
        if (response.status === 200) {
            jsonData = await response.json()
            break
        }
    }
    return jsonData
}

export const getMetrcReceiptActiveDataByParams = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, lastModifiedStart, pageNumber, pageSize) => {
    console.log(metrcApiEndpoint + 'sales/v2/receipts/active?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize)

    const response = await fetch(metrcApiEndpoint + 'sales/v2/receipts/active?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        }
    });
    if (response.status !== 200) return 'failed'
    const jsonData = await response.json()
    // console.log(jsonData)
    return jsonData
}

export const getMetrcReceiptInActiveDataByParams = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, lastModifiedStart, pageNumber, pageSize) => {
    console.log(metrcApiEndpoint + 'sales/v2/receipts/inactive?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize)
    const response = await fetch(metrcApiEndpoint + 'sales/v2/receipts/inactive?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        }
    });
    if (response.status !== 200) return 'failed'
    const jsonData = await response.json()
    return jsonData
}

export const getMetrcActivePackageDataByParams = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, lastModifiedStart, pageNumber, pageSize) => {

    try {
        console.log("Metrc >>>", metrcApiEndpoint + 'packages/v2/active?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize)
        const response = await fetch(metrcApiEndpoint + 'packages/v2/active?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize, {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
            }
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const jsonData = await response.json();
            return jsonData;
        } else {
            // If not JSON, return raw text to help debugging
            const text = await response.text();
            console.log("---------- error -------------  getMetrcActivePackageDataByParams failed 2")
            return []
        }
    } catch (err) {
        console.error('Fetch or JSON parse failed:', err);
        console.log("---------- error -------------  getMetrcActivePackageDataByParams failed 3")
        return []
        // throw err;
        // additional handling: retry logic, user-friendly error, etc.
    }
}

export const getMetrcInactivePackageDataByParams = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, lastModifiedStart, pageNumber, pageSize) => {
    try {
        console.log("Metrc >>>", metrcApiEndpoint + 'packages/v2/inactive?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize)
        const response = await fetch(metrcApiEndpoint + 'packages/v2/inactive?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize, {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
            }
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const jsonData = await response.json();
            return jsonData;
        } else {
            // If not JSON, return raw text to help debugging
            const text = await response.text();
            console.log("---------- error -------------  getMetrcInactivePackageDataByParams failed 2")
            return []
        }
    } catch (err) {
        console.error('Fetch or JSON parse failed:', err);
        console.log("---------- error -------------  getMetrcInactivePackageDataByParams failed 3")
        return []
        // throw err;
        // additional handling: retry logic, user-friendly error, etc.
    }

}

export const getMetrcDeliveryPackagesByParams = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, deliveryId, pageNumber, pageSize) => {

    console.log("Metrc >>>", metrcApiEndpoint + 'transfers/v2/deliveries/' + deliveryId + '/packages')

    const response = await fetch(metrcApiEndpoint + 'transfers/v2/deliveries/' + deliveryId + '/packages', {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        }
    });
    // console.log("response>>>>>>", response.status)
    if (response.status !== 200) return 'failed'
    const jsonData = await response.json()
    return jsonData
}

export const fetchTestResultByPackageIdForOnePage = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, lastModifiedStart, packageId, pageNumber, pageSize) => {

    console.log("Metrc >>>", metrcApiEndpoint + 'labtests/v2/results?packageId=' + packageId + '&licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize)

    const response = await fetch(metrcApiEndpoint + 'labtests/v2/results?packageId=' + packageId + '&licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        }
    });
    const jsonData = await response.json()
    return jsonData
}

export const getMetrcIncomingTransferDataByParams = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, lastModifiedStart, pageNumber, pageSize) => {
    try {
        console.log("Metrc >>>", metrcApiEndpoint + 'transfers/v2/incoming?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize)

        const response = await fetch(metrcApiEndpoint + 'transfers/v2/incoming?licenseNumber=' + cannabisLicense + '&lastModifiedStart=' + lastModifiedStart + '&lastModifiedEnd=' + lastModifiedEnd + '&pageNumber=' + pageNumber + '&pageSize=' + pageSize, {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
            }
        });

        // if (!response.ok) {
        //     const text = await response.text();
        //     console.log("---------- error -------------  getMetrcIncomingTransferDataByParams failed")
        //     return []
        // }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const jsonData = await response.json();
            return jsonData;
        } else {
            // If not JSON, return raw text to help debugging
            const text = await response.text();
            console.log("---------- error -------------  getMetrcIncomingTransferDataByParams failed 2")
            return []
        }
    } catch (err) {
        console.error('Fetch or JSON parse failed:', err);
        console.log("---------- error -------------  getMetrcIncomingTransferDataByParams failed 3")
        return []
        // throw err;
        // additional handling: retry logic, user-friendly error, etc.
    }
}

export const postAdjustOnePackage = async (context, dispensaryId, paramData) => {
    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const locationState = metrcInfo.locationState
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    console.log("Metrc >>>", metrcApiEndpoint + 'packages/v2/adjust?licenseNumber=' + cannabisLicense)
    // const postData = [
    //     {
    //         "Label": "ABCDEF012345670000013009",
    //         "Quantity": -1.0,
    //         "UnitOfMeasure": "Grams",
    //         "AdjustmentReason": "Drying",
    //         "AdjustmentDate": "2024-03-29",
    //         "ReasonNote": "Drying ReasonNote"
    //     }
    // ]
    // const response = await fetch("https://sandbox-api-ok.metrc.com/" + 'packages/v2/adjust?licenseNumber=' + "402R-X0001", {
    //     method: 'POST',
    //     headers: {
    //         'content-type': 'application/json',
    //         'Authorization': 'Basic ' + base64encode("PhxQv8FCNY24sBKY4dTnqqNfHFTW275W8AVP0LcKWPCFEto5" + ":" + "O6-GVAUBnJxzgQo7ptJeRgSJ26OHAClx4f5g6WAVLiGOKsnh")
    //     },
    //     body: JSON.stringify(postData)
    // });
    console.log("paramData >>>>> ", paramData)
    console.log("setFourDecimals(paramData.deltaQty) >>>>> ", setFourDecimals(paramData.deltaQty))
    const postData = [
        {
            "Label": paramData.packageLabel,
            "Quantity": setFourDecimals(paramData.deltaQty),
            "UnitOfMeasure": paramData.package.UnitOfMeasureName,
            "AdjustmentReason": paramData.reason,
            "AdjustmentDate": new Date().toISOString().slice(0, 10),
            "ReasonNote": paramData.notes
        }
    ]
    const response = await fetch(metrcApiEndpoint + 'packages/v2/adjust?licenseNumber=' + cannabisLicense, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        },
        body: JSON.stringify(postData)
    });
    return response.status
}

export const unFinalizeOrderByMetrcId = async (context, dispensaryId, metrcId) => {
    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const locationState = metrcInfo.locationState
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    console.log("Metrc >>>  PUT", metrcApiEndpoint + 'sales/v2/receipts/unfinalize?licenseNumber=' + cannabisLicense)
    const postData = [
        {
            "Id": metrcId
        }
    ]
    const response = await fetch(metrcApiEndpoint + 'sales/v2/receipts/unfinalize?licenseNumber=' + cannabisLicense, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        },
        body: JSON.stringify(postData)
    });
    const postJson = await response.json()
    if (response.status === 200) {
        // console.log(postResult.status)
        // console.log(postJson)
    } else {
        console.log(response.status)
        console.log(postJson)
    }
    return response
}

export const finalizeOrderByMetrcId = async (context, dispensaryId, metrcId) => {
    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const locationState = metrcInfo.locationState
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    console.log("Metrc >>>  PUT", metrcApiEndpoint + 'sales/v2/receipts/finalize?licenseNumber=' + cannabisLicense)
    const postData = [
        {
            "Id": metrcId
        }
    ]
    const response = await fetch(metrcApiEndpoint + 'sales/v2/receipts/finalize?licenseNumber=' + cannabisLicense, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        },
        body: JSON.stringify(postData)
    });
    const postJson = await response.json()
    if (response.status === 200) {
        // console.log(postResult.status)
        // console.log(postJson)
    } else {
        console.log(response.status)
        console.log(postJson)
    }
    return response
}

export const postMetrcRecordReceipts = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, paramData) => {

    console.log("Metrc >>>", metrcApiEndpoint + 'sales/v2/receipts?licenseNumber=' + cannabisLicense)
    // const postData = [
    //     {
    //         "SalesDateTime": "2024-04-01T16:44:53.000",
    //         "SalesCustomerType": "Patient",
    //         "PatientLicenseNumber": "123",
    //         "CaregiverLicenseNumber": null,
    //         "IdentificationMethod": null,
    //         "PatientRegistrationLocationId": null,
    //         "Transactions": [
    //             {
    //                 "PackageLabel": "ABCDEF012345670000013009",
    //                 "Quantity": 0.2,
    //                 "UnitOfMeasure": "Grams",
    //                 "TotalAmount": 19.5,
    //                 "UnitThcPercent": null,
    //                 "UnitThcContent": null,
    //                 "UnitThcContentUnitOfMeasure": null,
    //                 "UnitWeight": null,
    //                 "UnitWeightUnitOfMeasure": null,
    //                 "InvoiceNumber": null,
    //                 "Price": null,
    //                 "ExciseTax": null,
    //                 "CityTax": null,
    //                 "CountyTax": null,
    //                 "MunicipalTax": null,
    //                 "DiscountAmount": null,
    //                 "SubTotal": null,
    //                 "SalesTax": null
    //             }
    //         ]
    //     }
    // ]
    // const response = await fetch("https://sandbox-api-ok.metrc.com/" + 'sales/v2/receipts?licenseNumber=' + "402R-X0001", {
    //     method: 'POST',
    //     headers: {
    //         'content-type': 'application/json',
    //         'Authorization': 'Basic ' + base64encode("PhxQv8FCNY24sBKY4dTnqqNfHFTW275W8AVP0LcKWPCFEto5" + ":" + "O6-GVAUBnJxzgQo7ptJeRgSJ26OHAClx4f5g6WAVLiGOKsnh")
    //     },
    //     body: JSON.stringify(postData)
    // });
    const response = await fetch(metrcApiEndpoint + 'sales/v2/receipts?licenseNumber=' + cannabisLicense, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        },
        body: JSON.stringify(paramData)
    });
    return response
}
export const putMetrcRecordReceipts = async (metrcApiEndpoint, metrcApiKey, cannabisLicense, paramData) => {

    console.log("Metrc >>>  PUT: ", paramData[0].ID, metrcApiEndpoint + 'sales/v2/receipts?licenseNumber=' + cannabisLicense)
    // const postData = [
    //     {
    //         "SalesDateTime": "2024-04-01T16:44:53.000",
    //         "SalesCustomerType": "Patient",
    //         "PatientLicenseNumber": "123",
    //         "CaregiverLicenseNumber": null,
    //         "IdentificationMethod": null,
    //         "PatientRegistrationLocationId": null,
    //         "Transactions": [
    //             {
    //                 "PackageLabel": "ABCDEF012345670000013009",
    //                 "Quantity": 0.2,
    //                 "UnitOfMeasure": "Grams",
    //                 "TotalAmount": 19.5,
    //                 "UnitThcPercent": null,
    //                 "UnitThcContent": null,
    //                 "UnitThcContentUnitOfMeasure": null,
    //                 "UnitWeight": null,
    //                 "UnitWeightUnitOfMeasure": null,
    //                 "InvoiceNumber": null,
    //                 "Price": null,
    //                 "ExciseTax": null,
    //                 "CityTax": null,
    //                 "CountyTax": null,
    //                 "MunicipalTax": null,
    //                 "DiscountAmount": null,
    //                 "SubTotal": null,
    //                 "SalesTax": null
    //             }
    //         ]
    //     }
    // ]
    // const response = await fetch("https://sandbox-api-ok.metrc.com/" + 'sales/v2/receipts?licenseNumber=' + "402R-X0001", {
    //     method: 'POST',
    //     headers: {
    //         'content-type': 'application/json',
    //         'Authorization': 'Basic ' + base64encode("PhxQv8FCNY24sBKY4dTnqqNfHFTW275W8AVP0LcKWPCFEto5" + ":" + "O6-GVAUBnJxzgQo7ptJeRgSJ26OHAClx4f5g6WAVLiGOKsnh")
    //     },
    //     body: JSON.stringify(postData)
    // });
    const response = await fetch(metrcApiEndpoint + 'sales/v2/receipts?licenseNumber=' + cannabisLicense, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        },
        body: JSON.stringify(paramData)
    });
    return response
}

export const finishMetrcPackage = async (context, dispensaryId, paramData) => {
    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const locationState = metrcInfo.locationState
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    console.log("Metrc >>>", metrcApiEndpoint + 'packages/v2/finish?licenseNumber=' + cannabisLicense)
    // const postData = [
    //     {
    //         "Label": "ABCDEF012345670000019145",
    //         "ActualDate": "2024-04-02"
    //     }
    // ]
    // const response = await fetch("https://sandbox-api-ok.metrc.com/" + 'packages/v2/finish?licenseNumber=' + "402R-X0001", {
    //     method: 'POST',
    //     headers: {
    //         'content-type': 'application/json',
    //         'Authorization': 'Basic ' + base64encode("PhxQv8FCNY24sBKY4dTnqqNfHFTW275W8AVP0LcKWPCFEto5" + ":" + "O6-GVAUBnJxzgQo7ptJeRgSJ26OHAClx4f5g6WAVLiGOKsnh")
    //     },
    //     body: JSON.stringify(postData)
    // });
    const response = await fetch(metrcApiEndpoint + 'packages/v2/finish?licenseNumber=' + cannabisLicense, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        },
        body: JSON.stringify(paramData)
    });
    return response.status
}

export const unFinishMetrcPackage = async (context, dispensaryId, paramData) => {
    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const locationState = metrcInfo.locationState
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    console.log("Metrc >>>", metrcApiEndpoint + 'packages/v2/unfinish?licenseNumber=' + cannabisLicense)
    // const postData = [
    //     {
    //         "Label": "ABCDEF012345670000019145",
    //     }
    // ]
    // const response = await fetch("https://sandbox-api-ok.metrc.com/" + 'packages/v2/unfinish?licenseNumber=' + "402R-X0001", {
    //     method: 'POST',
    //     headers: {
    //         'content-type': 'application/json',
    //         'Authorization': 'Basic ' + base64encode("PhxQv8FCNY24sBKY4dTnqqNfHFTW275W8AVP0LcKWPCFEto5" + ":" + "O6-GVAUBnJxzgQo7ptJeRgSJ26OHAClx4f5g6WAVLiGOKsnh")
    //     },
    //     body: JSON.stringify(postData)
    // });
    const response = await fetch(metrcApiEndpoint + 'packages/v2/unfinish?licenseNumber=' + cannabisLicense, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        },
        body: JSON.stringify(paramData)
    });
    return response.status
}

export const postMetrcReceiptByOrderId = async (context, dispensaryId, orderId) => {

    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const locationState = metrcInfo.locationState
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    const order = await context.prisma.order.findUnique({
        where: {
            id: orderId
        },
        include: {
            OrderItem: {
                include: {
                    product: true,
                    package: true,
                    TaxHistory: true,
                }
            },
            customer: true
        }
    })

    const salesDateTime = convertUtcToStateTz(order.createdAt, locationState);

    // const salesDateTime = moment().tz(stateTimezones[locationState]).format('YYYY-MM-DDTHH:mm:ss.SSS')
    const salesCustomerType = 'Patient'
    const patientLicenseNumber = order.customer.medicalLicense.toUpperCase()
    let transactions: any = []
    const orderItems = order.OrderItem.filter(item => item.mjType === OrderMjType.MJ)
    for (let i = 0; i < orderItems.length; i++) {
        // console.log("order.OrderItem.TaxHistory", orderItems.TaxHistory)
        let totalTaxAmount = 0
        if (orderItems[i].TaxHistory.length > 0) {
            totalTaxAmount = setFourDecimals(orderItems[i].TaxHistory.reduce((sum, tax) => setFourDecimals(setFourDecimals(sum) + setFourDecimals(tax.taxAmount)), 0));
        }


        const amount = setFourDecimals(orderItems[i].amount)
        const discountedAmount = setFourDecimals(orderItems[i].discountedAmount)
        const loyaltyAmount = setFourDecimals(orderItems[i].loyaltyAmount)
        const totalAmount = setFourDecimals(amount - discountedAmount - loyaltyAmount - setFourDecimals(totalTaxAmount))

        const totalAmountResult = {
            amount,
            discountedAmount,
            loyaltyAmount,
            totalTaxAmount,
            totalAmount
        }

        transactions.push({
            "PackageLabel": orderItems[i].packageLabel,
            "Quantity": orderItems[i].quantity,
            "UnitOfMeasure": orderItems[i].package.UnitOfMeasureName,
            "TotalAmount": totalAmount,
            "UnitThcPercent": null,
            "UnitThcContent": null,
            "UnitThcContentUnitOfMeasure": null,
            "UnitWeight": null,
            "UnitWeightUnitOfMeasure": null,
            "InvoiceNumber": null,
            "Price": null,
            "ExciseTax": null,
            "CityTax": null,
            "CountyTax": null,
            "MunicipalTax": null,
            "DiscountAmount": null,
            "SubTotal": null,
            "SalesTax": null
        })
    }

    const paramData = [
        {
            "SalesDateTime": salesDateTime,
            "SalesCustomerType": salesCustomerType,
            "PatientLicenseNumber": patientLicenseNumber,
            "CaregiverLicenseNumber": null,
            "IdentificationMethod": null,
            "PatientRegistrationLocationId": null,
            "Transactions": transactions
        }
    ]
    // console.log("transactions >>> ", transactions)
    const postResult = await postMetrcRecordReceipts(metrcApiEndpoint, metrcApiKey, cannabisLicense, paramData)
    const postJson = await postResult.json()
    if (postResult.status === 200) {
        const metrcId = postJson.Ids[0]
        const updateMetrcId = await context.prisma.order.update({
            where: {
                id: orderId
            },
            data: {
                metrcId: metrcId,
                isReportedToMetrc: true
            }
        })
        // console.log(postResult.status)
        // console.log(postJson)
    } else {
        console.log(postResult.status)
        console.log(postJson)
    }
    return postResult.status
}

export const putMetrcReceiptByOrderId = async (context, dispensaryId, orderId) => {

    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const locationState = metrcInfo.locationState
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    const order = await context.prisma.order.findUnique({
        where: {
            id: orderId
        },
        include: {
            OrderItem: {
                include: {
                    package: true,
                    TaxHistory: true,
                }
            },
            customer: true
        }
    })

    const salesDateTime = moment().tz(stateTimezones[locationState]).format('YYYY-MM-DDTHH:mm:ss.SSS')
    const salesCustomerType = 'Patient'
    const patientLicenseNumber = order.customer.medicalLicense.toUpperCase()
    const metrcId = order.metrcId
    let transactions: any = []
    const orderItems = order.OrderItem
    for (let i = 0; i < order.OrderItem.length; i++) {
        // console.log("order.OrderItem.TaxHistory", orderItems.TaxHistory)
        let totalTaxAmount = 0
        if (orderItems.TaxHistory.length > 0) {
            totalTaxAmount = orderItems.TaxHistory.reduce((sum, tax) => sum + tax.taxAmount, 0);
        }
        // console.log("totalTaxAmount>>>>", totalTaxAmount)
        transactions.push({
            "PackageLabel": orderItems.packageLabel,
            "Quantity": truncateToTwoDecimals(orderItems.quantity),
            "UnitOfMeasure": orderItems.package.UnitOfMeasureName,
            "TotalAmount": truncateToTwoDecimals(orderItems.amount - orderItems.discountedAmount - orderItems.loyaltyAmount - totalTaxAmount),
            "UnitThcPercent": null,
            "UnitThcContent": null,
            "UnitThcContentUnitOfMeasure": null,
            "UnitWeight": null,
            "UnitWeightUnitOfMeasure": null,
            "InvoiceNumber": null,
            "Price": null,
            "ExciseTax": null,
            "CityTax": null,
            "CountyTax": null,
            "MunicipalTax": null,
            "DiscountAmount": null,
            "SubTotal": null,
            "SalesTax": null
        })
    }

    const paramData = [
        {
            "ID": metrcId,
            "SalesDateTime": salesDateTime,
            "SalesCustomerType": salesCustomerType,
            "PatientLicenseNumber": patientLicenseNumber,
            "CaregiverLicenseNumber": null,
            "IdentificationMethod": null,
            "PatientRegistrationLocationId": null,
            "Transactions": transactions
        }
    ]
    // console.log(paramData)
    // console.log("transactions >>> ", transactions)
    const postResult = await putMetrcRecordReceipts(metrcApiEndpoint, metrcApiKey, cannabisLicense, paramData)
    const postJson = await postResult.json()
    if (postResult.status === 200) {
        // console.log(postResult.status)
        // console.log(postJson)
    } else {
        console.log(postResult.status)
        console.log(postJson)
    }
    return postResult.status
}

export const delMetrcReceipt = async (context, dispensaryId, metrcId, orderId) => {

    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const locationState = metrcInfo.locationState
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]
    // console.log("https://sandbox-api-ok.metrc.com/" + 'sales/v2/receipts/' + metrcId + '?licenseNumber=' + "402R-X0001")
    // const response = await fetch("https://sandbox-api-ok.metrc.com/" + 'sales/v2/receipts/' + metrcId + '?licenseNumber=' + "402R-X0001", {
    //     method: 'DELETE',
    //     headers: {
    //         'content-type': 'application/json',
    //         'Authorization': 'Basic ' + base64encode("PhxQv8FCNY24sBKY4dTnqqNfHFTW275W8AVP0LcKWPCFEto5" + ":" + "O6-GVAUBnJxzgQo7ptJeRgSJ26OHAClx4f5g6WAVLiGOKsnh")
    //     },
    // });
    console.log(metrcApiEndpoint + 'sales/v2/receipts/' + metrcId + '?licenseNumber=' + cannabisLicense)
    const response = await fetch(metrcApiEndpoint + 'sales/v2/receipts/' + metrcId + '?licenseNumber=' + cannabisLicense, {
        method: 'DELETE',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        },
    });

    if (response.status === 200) {
        const updateOrder = await context.prisma.order.update({
            where: { id: orderId },
            data: {
                metrcId: null,
                isReportedToMetrc: false
            },
        });
        if (updateOrder.id) return true
        else return false
    } else {
        return false
    }
}

export const getMetrcAllReceiptData = async (_args, context, lastModified) => {
    const lastModifiedStart = lastModified === 'defaultStartDate' ? defaultLastModifiedStart : lastModified
    const formattedLastModifiedStart = getFiveMinutesBeforeInISOStyle(moment.utc(lastModifiedStart).format("YYYY-MM-DDTHH:mm:ss[Z]"))

    let receiptData: any[] = []
    let receiptDetailData: any[] = []
    let onePageData: any
    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]
    const jsonData = await getMetrcReceiptActiveDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, 1, 20)
    // console.log("jsonData>> ", jsonData)
    for (let i = 1; i <= jsonData.TotalPages; i++) {
        onePageData = await getMetrcReceiptActiveDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, i, 20)
        receiptData.push(onePageData.Data)
    }

    const jsonDataInActive = await getMetrcReceiptInActiveDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, 1, 20)
    // console.log("jsonData>> ", jsonData)
    for (let i = 1; i <= jsonDataInActive.TotalPages; i++) {
        onePageData = await getMetrcReceiptInActiveDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, i, 20)
        receiptData.push(onePageData.Data)
    }
    receiptData = receiptData.flat()
    let metrcDataInput
    try {
        const promises = receiptData.map(async (receiptRecord) => {
            return await {
                metrcId: receiptRecord.Id,
                dispensaryId: _args.input.dispensaryId,
                drawerId: _args.input.drawerId,
                userId: _args.input.userId,
                cannabisLicense: receiptRecord.PatientLicenseNumber,
                orderType: OrderType.SALE,
                description: 'metrc-import',
                cashAmount: receiptRecord.TotalPrice,
                cost: 0,
                changeDue: 0,
                otherAmount: 0,
                discount: 0,
                loyalty: 0,
                tax: 0,
                mjType: OrderMjType.MJ,
                status: OrderStatus.PAID,
                orderDate: receiptRecord.SalesDateTime.slice(0, 10),
                isReportedToMetrc: true,
                salesDateTime: receiptRecord.SalesDateTime.slice(0, 19)
            };
        });
        metrcDataInput = await Promise.all(promises)
    } catch (error) {
        console.log(error)
    }
    // console.log("metrcDataInput>>>>>>>>", metrcDataInput)
    return metrcDataInput
}

export const getMetrcReceiptDetailData = async (_args, context) => {
    let syncedCount = 0
    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    const orders = await context.prisma.order.findMany({
        where: {
            metrcId: {
                gt: 0
            }
        },
        orderBy: {
            metrcId: 'desc'
        }
    });

    for (let i = 0; i < orders.length; i++) {
        let orderItemsData: any[] = []

        console.log("order: ", i)
        const detailData = await getMetrcReceiptByIdDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, orders[i].metrcId)
        // receiptDetailData.push(detailData)
        const orderItems = await detailData.Transactions
        for (let j = 0; j < detailData.TotalPackages; j++) {
            const orderItem = {
                orderId: orders[i].id,
                packageLabel: orderItems[j].PackageLabel,
                quantity: orderItems[j].QuantitySold,
                price: parseFloat((orderItems[j].TotalPrice / orderItems[j].QuantitySold).toFixed(2)) || 0,
                cost: 0,
                amount: orderItems[j].TotalPrice,
                costAmount: 0,
                metrcItemName: orderItems[j].ProductName,
            }
            console.log("item: ", j, " ", orderItem)

            orderItemsData.push(orderItem)
        }
        const creation = await context.prisma.orderItem.createMany({
            data: orderItemsData,
            skipDuplicates: true // Optional: skip duplicates if unique constraints exist  
        });
        if (creation.count > 0) {
            syncedCount += creation.count
            continue
        }
        else break

    }
    return syncedCount
}

export const getMetrcActivePackageData = async (_args, context, lastModified) => {
    const lastModifiedStart = lastModified === 'defaultStartDate' ? defaultLastModifiedStart : lastModified
    const formattedLastModifiedStart = getFiveMinutesBeforeInISOStyle(moment.utc(lastModifiedStart).format("YYYY-MM-DDTHH:mm:ss[Z]"))

    console.log(lastModifiedStart, formattedLastModifiedStart)
    let packageData: any[] = []
    let onePageData: any
    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]
    const jsonData = await getMetrcActivePackageDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, 1, 20)
    // console.log("jsonData>> ", jsonData)
    for (let i = 1; i <= jsonData.TotalPages; i++) {
        onePageData = await getMetrcActivePackageDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, i, 20)
        packageData.push(onePageData.Data)
    }
    packageData = packageData.flat()

    const metrcDataInput = packageData.map(packageRecord => {
        const item = packageRecord.Item; // Assuming Item is a property of package
        const statusOfPackage = packageRecord.IsOnHold
            ? PackageStatus.HOLD
            : packageRecord.IsFinished === true
                ? PackageStatus.FINISHED
                : PackageStatus.ACTIVE;
        return {
            dispensaryId: _args.input.dispensaryId,
            packageId: packageRecord.Id,
            packageStatus: statusOfPackage,
            productId: null,
            cost: 0,
            isConnectedWithProduct: false,
            originalQty: packageRecord.OriginalPackageQuantity,
            Quantity: packageRecord.Quantity,
            posQty: packageRecord.Quantity,
            packageLabel: packageRecord.Label,
            SourceHarvestCount: packageRecord.SourceHarvestCount,
            SourcePackageCount: packageRecord.SourcePackageCount,
            SourceProcessingJobCount: packageRecord.SourceProcessingJobCount,
            SourceHarvestNames: packageRecord.SourceHarvestNames,
            SourcePackageLabels: packageRecord.SourcePackageLabels,
            LocationId: packageRecord.LocationId,
            LocationName: packageRecord.LocationName,
            LocationTypeName: packageRecord.LocationTypeName,
            UnitOfMeasureName: packageRecord.UnitOfMeasureName,
            UnitOfMeasureAbbreviation: packageRecord.UnitOfMeasureAbbreviation,
            PatientLicenseNumber: packageRecord.PatientLicenseNumber,
            ItemFromFacilityLicenseNumber: packageRecord.ItemFromFacilityLicenseNumber,
            ItemFromFacilityName: packageRecord.ItemFromFacilityName,
            Note: packageRecord.Note,
            PackagedDate: packageRecord.PackagedDate,
            ExpirationDate: packageRecord.ExpirationDate,
            SellByDate: packageRecord.SellByDate,
            UseByDate: packageRecord.UseByDate,
            InitialLabTestingState: packageRecord.InitialLabTestingState,
            LabTestingState: packageRecord.LabTestingState,
            LabTestingStateDate: packageRecord.LabTestingStateDate,
            LabTestingPerformedDate: packageRecord.LabTestingPerformedDate,
            LabTestResultExpirationDateTime: packageRecord.LabTestResultExpirationDateTime,
            LabTestingRecordedDate: packageRecord.LabTestingRecordedDate,
            IsProductionBatch: packageRecord.IsProductionBatch,
            ProductionBatchNumber: packageRecord.ProductionBatchNumber,
            SourceProductionBatchNumbers: packageRecord.SourceProductionBatchNumbers,
            IsTradeSample: packageRecord.IsTradeSample,
            IsTradeSamplePersistent: packageRecord.IsTradeSamplePersistent,
            SourcePackageIsTradeSample: packageRecord.SourcePackageIsTradeSample,
            IsDonation: packageRecord.IsDonation,
            IsDonationPersistent: packageRecord.IsDonationPersistent,
            SourcePackageIsDonation: packageRecord.SourcePackageIsDonation,
            IsTestingSample: packageRecord.IsTestingSample,
            IsProcessValidationTestingSample: packageRecord.IsProcessValidationTestingSample,
            ProductRequiresRemediation: packageRecord.ProductRequiresRemediation,
            ContainsRemediatedProduct: packageRecord.ContainsRemediatedProduct,
            RemediationDate: packageRecord.RemediationDate,
            ProductRequiresDecontamination: packageRecord.ProductRequiresDecontamination,
            ContainsDecontaminatedProduct: packageRecord.ContainsDecontaminatedProduct,
            DecontaminationDate: packageRecord.DecontaminationDate,
            ReceivedDateTime: packageRecord.ReceivedDateTime,
            ReceivedFromManifestNumber: packageRecord.ReceivedFromManifestNumber,
            ReceivedFromFacilityLicenseNumber: packageRecord.ReceivedFromFacilityLicenseNumber,
            ReceivedFromFacilityName: packageRecord.ReceivedFromFacilityName,
            IsOnHold: packageRecord.IsOnHold,
            IsOnRecall: packageRecord.IsOnRecall,
            ArchivedDate: packageRecord.ArchivedDate,
            IsFinished: packageRecord.IsFinished,
            FinishedDate: packageRecord.FinishedDate,
            IsOnTrip: packageRecord.IsOnTrip,
            IsOnRetailerDelivery: packageRecord.IsOnRetailerDelivery,
            PackageForProductDestruction: packageRecord.PackageForProductDestruction,
            LastModified: packageRecord.LastModified,
            RetailIdQrCount: packageRecord.RetailIdQrCount,
            itemId: item?.Id,
            itemName: item?.Name,
            itemProductCategoryName: item?.ProductCategoryName,
            itemProductCategoryType: item?.ProductCategoryType,
            itemIsExpirationDateRequired: item?.IsExpirationDateRequired,
            itemHasExpirationDate: item?.HasExpirationDate,
            itemIsSellByDateRequired: item?.IsSellByDateRequired,
            itemHasSellByDate: item?.HasSellByDate,
            itemIsUseByDateRequired: item?.IsUseByDateRequired,
            itemHasUseByDate: item?.HasUseByDate,
            itemQuantityType: item?.QuantityType,
            itemDefaultLabTestingState: item?.DefaultLabTestingState,
            itemUnitOfMeasureName: item?.UnitOfMeasureName,
            itemApprovalStatus: item?.ApprovalStatus,
            itemApprovalStatusDateTime: item?.ApprovalStatusDateTime,
            itemStrainId: item?.StrainId,
            itemStrainName: item?.StrainName,
            itemItemBrandId: item?.ItemBrandId,
            itemItemBrandName: item?.ItemBrandName,
            itemAdministrationMethod: item?.AdministrationMethod,
            itemUnitCbdPercent: item?.UnitCbdPercent,
            itemUnitCbdContent: item?.UnitCbdContent,
            itemUnitCbdContentUnitOfMeasureName: item?.UnitCbdContentUnitOfMeasureName,
            itemUnitCbdContentDose: item?.UnitCbdContentDose,
            itemUnitCbdContentDoseUnitOfMeasureName: item?.UnitCbdContentDoseUnitOfMeasureName,
            itemUnitThcPercent: item?.UnitThcPercent,
            itemUnitThcContent: item?.UnitThcContent,
            itemUnitThcContentUnitOfMeasureName: item?.UnitThcContentUnitOfMeasureName,
            itemUnitThcContentDose: item?.UnitThcContentDose,
            itemUnitThcContentDoseUnitOfMeasureId: item?.UnitThcContentDoseUnitOfMeasureId,
            itemUnitThcContentDoseUnitOfMeasureName: item?.UnitThcContentDoseUnitOfMeasureName,
            itemUnitVolume: item?.UnitVolume,
            itemUnitVolumeUnitOfMeasureName: item?.UnitVolumeUnitOfMeasureName,
            itemUnitWeight: item?.UnitWeight,
            itemUnitWeightUnitOfMeasureName: item?.UnitWeightUnitOfMeasureName,
            itemServingSize: item?.ServingSize,
            itemNumberOfDoses: item?.NumberOfDoses,
            itemUnitQuantity: item?.UnitQuantity,
            itemUnitQuantityUnitOfMeasureName: item?.UnitQuantityUnitOfMeasureName,
            itemPublicIngredients: item?.PublicIngredients,
            itemDescription: item?.Description,
            itemAllergens: item?.Allergens,
            itemProductImages: item?.ProductImages,
            itemProductPhotoDescription: item?.ProductPhotoDescription,
            itemLabelImages: item?.LabelImages,
            itemLabelPhotoDescription: item?.LabelPhotoDescription,
            itemPackagingImages: item?.PackagingImages,
            itemPackagingPhotoDescription: item?.PackagingPhotoDescription,
            itemProductPDFDocuments: item?.ProductPDFDocuments,
            itemIsUsed: item?.IsUsed,
            itemLabTestBatchNames: item?.LabTestBatchNames,
            itemProcessingJobCategoryName: item?.ProcessingJobCategoryName,
            itemProductBrandName: item?.ProductBrandName,
        };
    });
    return metrcDataInput
    // const creation = await context.prisma.package.createMany({
    //     data: metrcDataInput,
    //     skipDuplicates: true
    // });

}
export const getMetrcInactivePackageData = async (_args, context, lastModified) => {
    const lastModifiedStart = lastModified === 'defaultStartDate' ? defaultLastModifiedStart : lastModified
    const formattedLastModifiedStart = getFiveMinutesBeforeInISOStyle(moment.utc(lastModifiedStart).format("YYYY-MM-DDTHH:mm:ss[Z]"))
    let packageData: any[] = []
    let onePageData: any
    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]
    const jsonData = await getMetrcInactivePackageDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, 1, 20)
    // console.log("jsonData>> ", jsonData)

    for (let i = 1; i <= jsonData.TotalPages; i++) {
        onePageData = await getMetrcInactivePackageDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, i, 20)
        packageData.push(onePageData.Data)
    }
    packageData = packageData.flat()
    const metrcDataInput = packageData.map(packageRecord => {
        const item = packageRecord.Item; // Assuming Item is a property of package
        const statusOfPackage = packageRecord.IsOnHold
            ? PackageStatus.HOLD
            : packageRecord.IsFinished === true
                ? PackageStatus.FINISHED
                : PackageStatus.ACTIVE;
        return {
            dispensaryId: _args.input.dispensaryId,
            packageId: packageRecord.Id,
            packageStatus: statusOfPackage,
            productId: null,
            cost: 0,
            isConnectedWithProduct: false,
            originalQty: packageRecord.OriginalPackageQuantity,
            Quantity: packageRecord.Quantity,
            posQty: packageRecord.Quantity,
            packageLabel: packageRecord.Label,
            SourceHarvestCount: packageRecord.SourceHarvestCount,
            SourcePackageCount: packageRecord.SourcePackageCount,
            SourceProcessingJobCount: packageRecord.SourceProcessingJobCount,
            SourceHarvestNames: packageRecord.SourceHarvestNames,
            SourcePackageLabels: packageRecord.SourcePackageLabels,
            LocationId: packageRecord.LocationId,
            LocationName: packageRecord.LocationName,
            LocationTypeName: packageRecord.LocationTypeName,
            UnitOfMeasureName: packageRecord.UnitOfMeasureName,
            UnitOfMeasureAbbreviation: packageRecord.UnitOfMeasureAbbreviation,
            PatientLicenseNumber: packageRecord.PatientLicenseNumber,
            ItemFromFacilityLicenseNumber: packageRecord.ItemFromFacilityLicenseNumber,
            ItemFromFacilityName: packageRecord.ItemFromFacilityName,
            Note: packageRecord.Note,
            PackagedDate: packageRecord.PackagedDate,
            ExpirationDate: packageRecord.ExpirationDate,
            SellByDate: packageRecord.SellByDate,
            UseByDate: packageRecord.UseByDate,
            InitialLabTestingState: packageRecord.InitialLabTestingState,
            LabTestingState: packageRecord.LabTestingState,
            LabTestingStateDate: packageRecord.LabTestingStateDate,
            LabTestingPerformedDate: packageRecord.LabTestingPerformedDate,
            LabTestResultExpirationDateTime: packageRecord.LabTestResultExpirationDateTime,
            LabTestingRecordedDate: packageRecord.LabTestingRecordedDate,
            IsProductionBatch: packageRecord.IsProductionBatch,
            ProductionBatchNumber: packageRecord.ProductionBatchNumber,
            SourceProductionBatchNumbers: packageRecord.SourceProductionBatchNumbers,
            IsTradeSample: packageRecord.IsTradeSample,
            IsTradeSamplePersistent: packageRecord.IsTradeSamplePersistent,
            SourcePackageIsTradeSample: packageRecord.SourcePackageIsTradeSample,
            IsDonation: packageRecord.IsDonation,
            IsDonationPersistent: packageRecord.IsDonationPersistent,
            SourcePackageIsDonation: packageRecord.SourcePackageIsDonation,
            IsTestingSample: packageRecord.IsTestingSample,
            IsProcessValidationTestingSample: packageRecord.IsProcessValidationTestingSample,
            ProductRequiresRemediation: packageRecord.ProductRequiresRemediation,
            ContainsRemediatedProduct: packageRecord.ContainsRemediatedProduct,
            RemediationDate: packageRecord.RemediationDate,
            ProductRequiresDecontamination: packageRecord.ProductRequiresDecontamination,
            ContainsDecontaminatedProduct: packageRecord.ContainsDecontaminatedProduct,
            DecontaminationDate: packageRecord.DecontaminationDate,
            ReceivedDateTime: packageRecord.ReceivedDateTime,
            ReceivedFromManifestNumber: packageRecord.ReceivedFromManifestNumber,
            ReceivedFromFacilityLicenseNumber: packageRecord.ReceivedFromFacilityLicenseNumber,
            ReceivedFromFacilityName: packageRecord.ReceivedFromFacilityName,
            IsOnHold: packageRecord.IsOnHold,
            IsOnRecall: packageRecord.IsOnRecall,
            ArchivedDate: packageRecord.ArchivedDate,
            IsFinished: packageRecord.IsFinished,
            FinishedDate: packageRecord.FinishedDate,
            IsOnTrip: packageRecord.IsOnTrip,
            IsOnRetailerDelivery: packageRecord.IsOnRetailerDelivery,
            PackageForProductDestruction: packageRecord.PackageForProductDestruction,
            LastModified: packageRecord.LastModified,
            RetailIdQrCount: packageRecord.RetailIdQrCount,
            itemId: item?.Id,
            itemName: item?.Name,
            itemProductCategoryName: item?.ProductCategoryName,
            itemProductCategoryType: item?.ProductCategoryType,
            itemIsExpirationDateRequired: item?.IsExpirationDateRequired,
            itemHasExpirationDate: item?.HasExpirationDate,
            itemIsSellByDateRequired: item?.IsSellByDateRequired,
            itemHasSellByDate: item?.HasSellByDate,
            itemIsUseByDateRequired: item?.IsUseByDateRequired,
            itemHasUseByDate: item?.HasUseByDate,
            itemQuantityType: item?.QuantityType,
            itemDefaultLabTestingState: item?.DefaultLabTestingState,
            itemUnitOfMeasureName: item?.UnitOfMeasureName,
            itemApprovalStatus: item?.ApprovalStatus,
            itemApprovalStatusDateTime: item?.ApprovalStatusDateTime,
            itemStrainId: item?.StrainId,
            itemStrainName: item?.StrainName,
            itemItemBrandId: item?.ItemBrandId,
            itemItemBrandName: item?.ItemBrandName,
            itemAdministrationMethod: item?.AdministrationMethod,
            itemUnitCbdPercent: item?.UnitCbdPercent,
            itemUnitCbdContent: item?.UnitCbdContent,
            itemUnitCbdContentUnitOfMeasureName: item?.UnitCbdContentUnitOfMeasureName,
            itemUnitCbdContentDose: item?.UnitCbdContentDose,
            itemUnitCbdContentDoseUnitOfMeasureName: item?.UnitCbdContentDoseUnitOfMeasureName,
            itemUnitThcPercent: item?.UnitThcPercent,
            itemUnitThcContent: item?.UnitThcContent,
            itemUnitThcContentUnitOfMeasureName: item?.UnitThcContentUnitOfMeasureName,
            itemUnitThcContentDose: item?.UnitThcContentDose,
            itemUnitThcContentDoseUnitOfMeasureId: item?.UnitThcContentDoseUnitOfMeasureId,
            itemUnitThcContentDoseUnitOfMeasureName: item?.UnitThcContentDoseUnitOfMeasureName,
            itemUnitVolume: item?.UnitVolume,
            itemUnitVolumeUnitOfMeasureName: item?.UnitVolumeUnitOfMeasureName,
            itemUnitWeight: item?.UnitWeight,
            itemUnitWeightUnitOfMeasureName: item?.UnitWeightUnitOfMeasureName,
            itemServingSize: item?.ServingSize,
            itemNumberOfDoses: item?.NumberOfDoses,
            itemUnitQuantity: item?.UnitQuantity,
            itemUnitQuantityUnitOfMeasureName: item?.UnitQuantityUnitOfMeasureName,
            itemPublicIngredients: item?.PublicIngredients,
            itemDescription: item?.Description,
            itemAllergens: item?.Allergens,
            itemProductImages: item?.ProductImages,
            itemProductPhotoDescription: item?.ProductPhotoDescription,
            itemLabelImages: item?.LabelImages,
            itemLabelPhotoDescription: item?.LabelPhotoDescription,
            itemPackagingImages: item?.PackagingImages,
            itemPackagingPhotoDescription: item?.PackagingPhotoDescription,
            itemProductPDFDocuments: item?.ProductPDFDocuments,
            itemIsUsed: item?.IsUsed,
            itemLabTestBatchNames: item?.LabTestBatchNames,
            itemProcessingJobCategoryName: item?.ProcessingJobCategoryName,
            itemProductBrandName: item?.ProductBrandName,
        };
    });
    return metrcDataInput
}

export const getMetrcDeliveryPackagesByDeliveryId = async (_args, context, deliveryId) => {
    let packageData: any[] = []
    let onePageData: any
    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    const jsonData = await getMetrcDeliveryPackagesByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, deliveryId, 1, 20)
    // packageData.push(jsonData.Data)
    for (let i = 1; i <= jsonData.TotalPages; i++) {
        onePageData = await getMetrcDeliveryPackagesByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, deliveryId, i, 20)
        if (onePageData === 'failed') continue
        packageData.push(onePageData.Data)
    }
    packageData = packageData.flat()
    const metrcDataInput = packageData.map(({ PackageId, PackageLabel, ShipmentPackageState, ShippedQuantity, ShippedUnitOfMeasureName, ReceivedQuantity, ReceivedUnitOfMeasureName, ...data }) => ({
        dispensaryId: _args.input.dispensaryId,
        deliveryId: deliveryId,
        packageId: PackageId,
        packageLabel: PackageLabel,
        ShipmentPackageState: ShipmentPackageState,
        ShippedQuantity: ShippedQuantity,
        ShippedUnitOfMeasureName: ShippedUnitOfMeasureName,
        ReceivedQuantity: ReceivedQuantity,
        ReceivedUnitOfMeasureName: ReceivedUnitOfMeasureName,
    }));
    // console.log("metrcDataInput", metrcDataInput)

    return metrcDataInput
}

export const getMetrcPackageInfoByPackageId = async (_args, context, packageId) => {
    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    console.log("Metrc >>>", metrcApiEndpoint + 'packages/v2/' + packageId + '?licenseNumber=' + cannabisLicense)

    const response = await fetch(metrcApiEndpoint + 'packages/v2/' + packageId + '?licenseNumber=' + cannabisLicense, {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Basic ' + base64encode(vendor_key + ":" + metrcApiKey)
        }
    });
    // console.log("response>>>>>>", response.status)
    if (response.status !== 200) return 'failed'
    const jsonData = await response.json()
    return jsonData
}

export const syncMetrcDeliveryPackages = async (_args, context) => {
    let syncedCount = 0
    let onePageData: any

    const savedPackages = await context.prisma.package.findMany({
        select: {
            packageId: true
        },
        where: { dispensaryId: _args.input.dispensaryId },
    })
    // console.log(savedPackages)
    const transfers = await context.prisma.transfer.findMany({
        where: {
            dispensaryId: _args.input.dispensaryId,
            ReceivedDateTime: { not: null }
        },
        orderBy: {
            deliveryId: 'desc',
        }
    })

    console.log("transfers >>>>> ", transfers)
    for (let i = 0; i < transfers.length; i++) {
        // console.log("number>>> ", i)
        onePageData = await getMetrcDeliveryPackagesByDeliveryId(_args, context, transfers[i].deliveryId)
        onePageData = onePageData.flat()
        // console.log("packageData>>>", packageData)
        const filterArray = savedPackages.map(b => b.packageId)
        const packageDataResult = onePageData.filter(a => filterArray.includes(a.packageId))
        const creation = await context.prisma.deliveryPackages.createMany({
            data: packageDataResult,
            skipDuplicates: true // Optional: skip duplicates if unique constraints exist  
        });
        if (creation.count > 0) {
            syncedCount += creation.count
            continue
        }
        else break

    }
    return syncedCount

}

export const getMetrcIncomingTransfer = async (_args, context, lastModified) => {
    const lastModifiedStart = lastModified === 'defaultStartDate' ? defaultLastModifiedStart : lastModified
    const formattedLastModifiedStart = getFiveMinutesBeforeInISOStyle(moment.utc(lastModifiedStart).format("YYYY-MM-DDTHH:mm:ss[Z]"))
    let onePageData: any
    const metrcInfo = await getMetrcInfoByDispensaryId(context, _args.input.dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    const jsonData = await getMetrcIncomingTransferDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, 1, 20)
    let transferData: any[] = []
    for (let i = 1; i <= jsonData.TotalPages; i++) {
        onePageData = await getMetrcIncomingTransferDataByParams(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, i, 20)
        transferData.push(onePageData.Data)
    }
    transferData = transferData.flat()

    const metrcDataInput = transferData.map(({
        Id,
        DeliveryId,
        PackageCount,
        ReceivedPackageCount,
        CreatedDateTime,
        ReceivedDateTime,
        ShipperFacilityLicenseNumber,
        ShipperFacilityName,
        ...data
    }) => ({
        dispensaryId: _args.input.dispensaryId,
        userId: _args.input.userId,
        transferType: TransferType.Incoming,
        isMJ: true,
        status: ReceivedPackageCount > 0 ? TransferStatus.ACCEPTED : TransferStatus.PENDING,
        transferId: Id,
        deliveryId: DeliveryId,
        PackageCount: PackageCount,
        ReceivedPackageCount: ReceivedPackageCount,
        CreatedDateTime: CreatedDateTime,
        ReceivedDateTime: ReceivedDateTime,
        ShipperFacilityLicenseNumber: ShipperFacilityLicenseNumber,
        ShipperFacilityName: ShipperFacilityName,
    }));
    return metrcDataInput
}

export const fetchTestResultByPackageId = async (context, dispensaryId, packageId) => {
    const lastModifiedStart = defaultLastModifiedStart
    const formattedLastModifiedStart = getFiveMinutesBeforeInISOStyle(moment.utc(lastModifiedStart).format("YYYY-MM-DDTHH:mm:ss[Z]"))
    let onePageData: any
    const metrcInfo = await getMetrcInfoByDispensaryId(context, dispensaryId)
    const metrcApiKey = metrcInfo.metrcApiKey
    const cannabisLicense = metrcInfo.cannabisLicense
    const metrcApiEndpoint = endPoints[metrcInfo.locationState]

    const jsonData = await fetchTestResultByPackageIdForOnePage(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, packageId, 1, 20)
    let testResultData: any[] = []
    for (let i = 1; i <= jsonData.TotalPages; i++) {
        onePageData = await fetchTestResultByPackageIdForOnePage(metrcApiEndpoint, metrcApiKey, cannabisLicense, formattedLastModifiedStart, packageId, i, 20)
        testResultData.push(onePageData.Data)
    }
    testResultData = testResultData.flat()

    const filteredTestResultData = testResultData.filter(item => item.TestResultLevel > 0)

    const metrcDataInput = filteredTestResultData.map(({
        LabTestResultId,
        LabFacilityLicenseNumber,
        SourcePackageLabel,
        TestPerformedDate,
        LabTestResultDocumentFileId,
        TestTypeName,
        TestPassed,
        TestResultLevel,
        TestComment,
        ...data
    }) => ({
        dispensaryId: dispensaryId,
        packageId: packageId,
        labTestResultId: LabTestResultId,
        labFacilityLicenseNumber: LabFacilityLicenseNumber,
        sourcePackageLabel: SourcePackageLabel,
        testPerformedDate: TestPerformedDate,
        labTestResultDocumentFileId: LabTestResultDocumentFileId,
        testTypeName: TestTypeName,
        testPassed: TestPassed,
        testResultLevel: TestResultLevel,
        testComment: TestComment,
    }));
    return metrcDataInput
}
