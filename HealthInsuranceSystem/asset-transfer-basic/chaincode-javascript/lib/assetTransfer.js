/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify  = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

class AssetTransfer extends Contract {

    // CreateAsset issues a new asset to the world state with given details.
    async RegisterClient(ctx, id, name, dob, nominee, policy_id) {
        const exists = await this.AssetExists(ctx, id);
        if (exists) {
            throw new Error(`The asset ${id} already exists`);
        }

        const asset = {
            ID: id,
            Name: name,
            Dob: dob,
            Nominee: nominee,
            PolicyId: policy_id,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));

        await this.IssuePolicy(ctx,id,policy_id);

        return JSON.stringify(asset);
    }

    // ReadAsset returns the asset stored in the world state with given id.
    async GetClientInfo(ctx, id) {
        const assetJSON = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    // UpdateAsset updates an existing asset in the world state with provided parameters.
    async UpdateClientDetails(ctx, id, name, dob, nominee, inspol) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        // overwriting original asset with new asset
        const asset = {
            ID: id,
            Name: name,
            Dob: dob,
            Nominee: nominee,
            InsurancePolicy: inspol,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        return ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
    }

    // DeleteAsset deletes an given asset from the world state.
    async DeleteAsset(ctx, id) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }

    // AssetExists returns true when asset with given ID exists in world state.
    async AssetExists(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        return assetJSON && assetJSON.length > 0;
    }

    // TransferAsset updates the owner field of asset with given id in the world state.
    async UpdateNominee(ctx, id, newNominee) {
        const assetString = await this.ReadAsset(ctx, id);
        const asset = JSON.parse(assetString);
        const oldNominee = asset.Nominee;
        asset.Nominee = newNominee;
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
        return oldNominee;
    }

    // GetAllAssets returns all assets found in the world state.
    async GetAllAssets(ctx) {
        const allResults = [];
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    async RegisterPolicy(ctx, id, name, duration, premium, total_amount, reimburse_amount) {
        const exists = await this.AssetExists(ctx, id);
        if (exists) {
            throw new Error(`The asset ${id} already exists`);
        }

        const asset = {
            ID: id,
            Name: name,
            Duraton: duration,
            Premium: premium,
            TotalAmount: total_amount,
            ReimburseAmount: reimburse_amount,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
        return JSON.stringify(asset);
    }

    // ReadAsset returns the asset stored in the world state with given id.
    async GetPolicyInfo(ctx, id) {
        const assetJSON = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    async IssuePolicy(ctx, client_id, policy_id) {
        /*const exists = await this.AssetExists(ctx, client_id);
        if (!exists) {
            throw new Error(`The asset ${client_id} do not exist`);
        }*/

        const exists2 = await this.AssetExists(ctx, policy_id);
        if (!exists2) {
            throw new Error(`The asset ${policy_id} do not exist`);
        }

        const assetString = await this.GetPolicyInfo(ctx, policy_id);
        const policy_asset = JSON.parse(assetString);
        const id=client_id+policy_id;

        const asset = {
            ID: id,
            Premium: policy_asset.Premium,
            AmountPaid: "$0",
            TotalAmount: policy_asset.TotalAmount,
            ReimburseAmount: policy_asset.ReimburseAmount,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
        return JSON.stringify(asset);
    }

    async GetPremiumInfo(ctx, client_id, policy_id) {
        const assetJSON = await ctx.stub.getState(client_id+policy_id); // get the asset from chaincode state
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${client_id+policy_id} does not exist`);
        }
        return assetJSON.toString();
    }

    async PayPremium(ctx, client_id, policy_id) {
        const exists = await this.AssetExists(ctx, client_id);
        if (!exists) {
            throw new Error(`The asset ${client_id} do not exist`);
        }

        const exists2 = await this.AssetExists(ctx, policy_id);
        if (!exists2) {
            throw new Error(`The asset ${policy_id} do not exist`);
        }

        const assetString = await this.GetPremiumInfo(ctx, client_id, policy_id);
        const premium_asset = JSON.parse(assetString);
        const amount=premium_asset.AmountPaid.toString();
        const pre=premium_asset.Premium.toString();
        var amt=parseInt(amount.substring(1))+parseInt(pre.substring(1));
        const id=client_id+policy_id;

        if(amt>=parseInt((premium_asset.TotalAmount.toString()).substring(1))){
            await this.Refund(ctx,client_id,policy_id);
            return `Refund Initiated`;
        }

        const asset = {
            ID: id,
            Premium: premium_asset.Premium,
            AmountPaid: "$"+amt.toString(),
            TotalAmount: premium_asset.TotalAmount,
            ReimburseAmount: premium_asset.ReimburseAmount,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        return ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
    }


    async Refund(ctx, client_id, policy_id) {
        const exists = await this.AssetExists(ctx, client_id);
        if (!exists) {
            throw new Error(`The asset ${client_id} do not exist`);
        }

        const exists2 = await this.AssetExists(ctx, policy_id);
        if (!exists2) {
            throw new Error(`The asset ${policy_id} do not exist`);
        }

        const assetString = await this.GetPremiumInfo(ctx, client_id, policy_id);
        const premium_asset = JSON.parse(assetString);

        const amount=premium_asset.AmountPaid.toString();
        const pre=premium_asset.Premium.toString();
        var amt=parseInt(amount.substring(1))+parseInt(pre.substring(1));
        var refund;

        if(amt<parseInt((premium_asset.TotalAmount.toString()).substring(1))){
            refund=amt;
        }
        else{
            refund=premium_asset.ReimburseAmount;
        }

        const id=client_id+policy_id;

        await this.DeleteAsset(ctx,id);

        const asset = {
            ID: id,
            RefundedAmount: refund,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        return ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
    }

}

module.exports = AssetTransfer;

/* 
async InitLedger(ctx) {
        const assets = [
            {
                ID: 'asset1',
                Name: 'Kapil',
                Dob: '12-03-1988',
                Nominee: 'Tomoko',
                InsuarancePolicy: 'Policy xyz',
            },
            {
                ID: 'asset2',
                Name: 'Kapil',
                Dob: '12-03-1988',
                Nominee: 'Tomoko',
                InsuarancePolicy: 'Policy xyz',
            },
            {
                ID: 'asset3',
                Name: 'Kapil',
                Dob: '12-03-1988',
                Nominee: 'Tomoko',
                InsuarancePolicy: 'Policy xyz',
            },
            {
                ID: 'asset4',
                Name: 'Kapil',
                Dob: '12-03-1988',
                Nominee: 'Tomoko',
                InsuarancePolicy: 'Policy xyz',
            }, 
            {
                ID: 'asset5',
                Name: 'Kapil',
                Dob: '12-03-1988',
                Nominee: 'Tomoko',
                InsuarancePolicy: 'Policy xyz',
            },
            {
                ID: 'asset6',
                Name: 'Kapil',
                Dob: '12-03-1988',
                Nominee: 'Tomoko',
                InsuarancePolicy: 'Policy xyz',
            },
        ];

        for (const asset of assets) {
            asset.docType = 'asset';
            await ctx.stub.putState(asset.ID, Buffer.from(stringify(sortKeysRecursive(asset))));
        }
    }
*/
