const {
  KEYGEN_PRODUCT_TOKEN,
  KEYGEN_ACCOUNT_ID,
  KEYGEN_POLICY_ID
} = process.env

const { promisify } = require('util')
const fetch = require('node-fetch')
const csv = require('csv')
const crypto = require('crypto')
const fs = require('fs')
const parse = promisify(csv.parse)

async function main() {
  const data = fs.readFileSync('data/users.csv')
  const rows = await parse(data, { columns: true })

  for (let row of rows) {
    // Generate a secure temporary password for the user
    const password = crypto.randomBytes(16).toString('hex')

    // Get the column data from the current row
    const {
      firstName,
      lastName,
      email,
      platform
    } = row

    // Create a Keygen user using the current dataset
    const ures = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${KEYGEN_PRODUCT_TOKEN}`
      },
      body: JSON.stringify({
        data: {
          type: 'users',
          attributes: {
            firstName,
            lastName,
            email,
            password
          }
        }
      })
    })

    const { data: user, errors: errs1 } = await ures.json()
    if (errs1) {
      console.error(`Error while creating user for ${email}`, errs1)

      continue
    }

    console.log(`Successfully created user for ${user.attributes.email} (${user.id})`)
    console.log(`\tTemp password: ${password}`)

    // Generate a short license key that can be easily entered by hand
    const key = crypto.randomBytes(8).toString('hex').split(/(.{4})/).filter(Boolean).join('-')

    // Create a license for the new user
    const lres = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/licenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${KEYGEN_PRODUCT_TOKEN}`
      },
      body: JSON.stringify({
        data: {
          type: 'licenses',
          attributes: {
            metadata: { platform },
            key
          },
          relationships: {
            policy: {
              data: { type: 'policies', id: KEYGEN_POLICY_ID }
            },
            user: {
              data: { type: 'users', id: user.id }
            }
          }
        }
      })
    })

    const { data: license, errors: errs2 } = await lres.json()
    if (errs2) {
      console.error(`Error while creating license for ${email}`, errs2)

      continue
    }

    console.log(`Successfully created license for ${user.attributes.email} (${license.id})`)
    console.log(`\tLicense key: ${license.attributes.key}`)

    // Next, you could email the user their license key and instructions on resetting
    // their temporary password. You can implement password reset logic using our
    // API: https://keygen.sh/docs/api/#passwords-forgot.

    console.log('='.repeat(80))
  }

  console.log('Done')
}

main()