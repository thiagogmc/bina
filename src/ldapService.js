const debug = require('debug')('Bina:LdapClient')
const ldapjs = require('ldapjs')

const idField = process.env.IDENT_FIELD
const fullNameField = process.env.FULL_NAME_FIELD
const phonesFields = process.env.PHONE_FIELDS.split(',')
const otherFields = process.env.OTHER_FIELDS.split(',')
const emailFields = process.env.EMAIL_FIELDS.split(',')
const cacheDuration = process.env.CACHE_DURATION || 300 // default 5min
const connectTimeout = process.env.CONNECT_TIMEOUT || 10 // default 10sec
const operationTimeout = process.env.OPERATION_TIMEOUT || 10 // default 10sec

const hosts = process.env.LDAP_HOST.split(';;')
const users = process.env.LDAP_USER.split(';;')
const passwords = process.env.LDAP_PASS.split(';;')
const arrBases = process.env.LDAP_BASE.split(';;')

const resultCache = {
  time: new Date(),
  duration: cacheDuration * 1000, // time in milisseconds
  data: new Array(),
  expired() {
    return this.data ? (this.time.valueOf() + this.duration) < Date.now() : true
  },
  setData(data) {
    debug('Saving data in cache')
    this.time = new Date()
    this.data = this.data.concat(data)
  },
}

module.exports = (cb) => {
  if (!resultCache.expired() && resultCache.data.length > 0) {
    debug('Using cache result')
    cb(null, resultCache.data)
    return
  }
  resultCache.data = [];
  const promisesArr = new Array();
  for (let i = 0; i < hosts.length; i++) {
    debug(`Connecting to Ldap Server… ${hosts[i]}`)
    promisesArr.push(connectsToServer(i))
  }
  Promise.all(promisesArr)
  .then(() => {
    cb(null,resultCache.data)
  })
}

function connectsToServer(i) {
  return new Promise(((resolve, reject) => {
    const ldapClient = ldapjs.createClient({
      url: hosts[i],
      tlsOptions: {
        rejectUnauthorized: false,
      },
      connectTimeout: connectTimeout * 1000,
      timeout: operationTimeout * 1000,
    })
    
    ldapClient.on('error', function(err) {
      resolve(debug(`ERROR LDAP connection failed: ${hosts[i]}`, err))
    });

    ldapClient.on('timeout', (err) => {
      resolve(debug(`ERROR TIMEOUT: ${hosts[i]}`, err));
    });

    ldapClient.on('connectTimeout', (err) => {
      resolve(debug(`ERROR connectTimeout: ${hosts[i]}`, err));
    });

    ldapClient.bind(users[i], passwords[i], (bindError) => {
      debug(`Login in Ldap Server: ${hosts[i]}`)
      if (bindError) {
        return resolve(debug(`ERROR Login in Ldap Server: ${hosts[i]}`))
        //cb(bindError, null)
      }

      /* eslint prefer-template: 0 */
      const filter = process.env.LDAP_FILTER || '(&' +
        '(|' +
        phonesFields.map(item => `(${item}=*)`).join('') +
        ')' +
        '(objectCategory=person)' +
        '(!(UserAccountControl:1.2.840.113556.1.4.803:=2))' + // User active
        '(|' +
          '(objectClass=user)' + // User object
          '(objectClass=contact)' + // Contact object
        ')' +
      ')'
      const attributes = ['objectClass'].concat(
        fullNameField,
        phonesFields,
        otherFields,
        idField,
        emailFields
      )
      const options = {
        scope: 'sub',
        paged: true,
        sizeLimit: 100,
        filter,
        attributes,
      }

      const base = arrBases[i]
     
      ldapClient.search(base, options, (errSearch, result) => {
        debug(`BaseDN: ${base}`)
        debug(`Searching with filter: ${options.filter}`)
        if (errSearch) {
          resolve(debug(`ERROR Search in Ldap Server: ${hosts[i]}`))
          //cb(errSearch, null)
        }
        const list = []
        result.on('searchEntry', (entry) => {
          const contact = {}
          contact.id = entry.object[idField]
          contact.fullName = entry.object[fullNameField]
          contact.phones = {}
          phonesFields.forEach((phone) => {
            if (entry.object[phone]) {
              contact.phones[phone] = entry.object[phone]
            }
          })
          contact.emails = {}
          emailFields.forEach((email) => {
            if (entry.object[email]) {
              contact.emails[email] = entry.object[email]
            }
          })
          otherFields.forEach((field) => {
            if (entry.object[field]) {
              contact[field] = entry.object[field]
            }
          })
          if (entry.object.objectClass.some(oc => oc === 'user')) {
            contact.objectClass = 'user'
          } else {
            contact.objectClass = 'contact'
          }
          list.push(contact)
        })
        result.on('end', () => {
          // Order by displayName
          list.sort(function (a, b) {
            if(a.fullName){
              a.fullName.localeCompare(b.fullName)
            }
          })

          debug(`${hosts[i]}: Found ${list.length} objects`)
          resultCache.setData(list)
          resolve()
        })
      })
    })
  }))
}