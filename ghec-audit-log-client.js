const { allEntriesQuery } = require('./ghec-audit-log-queries')

async function requestV4Entries (graphqlApi, org, limit, cursor) {
  let entries = []
  const variables = {
    org: org,
    page: null
  }

  let hasNextPage = true
  let firstPageCursorId = null
  let foundCursor = false
  const hasLimit = limit || false
  let limitReached = false
  while (hasNextPage && !foundCursor && !limitReached) {
    const data = await graphqlApi(allEntriesQuery, variables)
    let newEntries = data.organization.auditLog.nodes

    // Cursor check
    if (cursor != null) {
      const index = newEntries.findIndex((elem) => elem.id === cursor)
      if (index !== -1) {
        newEntries = newEntries.slice(0, index)
        foundCursor = true
      }
    }

    entries = entries.concat(newEntries)
    hasNextPage = data.organization.auditLog.pageInfo.hasNextPage
    variables.page = data.organization.auditLog.pageInfo.endCursor

    // Check limit
    if (hasLimit) {
      if (entries.length >= limit) {
        entries = entries.slice(0, limit)
      }
      limitReached = true
    }

    // Store last cursor request
    if (!firstPageCursorId && newEntries.length !== 0) {
      firstPageCursorId = newEntries[0].id
    }
  }
  return { data: entries, newestCursorId: firstPageCursorId }
}

async function requestV3Entries(octokit, org, limit, cursor) {
  let entries = []
  const hasLimit = limit || false
  try {
    for await (const response of octokit.paginate.iterator(`GET /orgs/{org}/audit-log?include=all&per_page=5&after=${cursor}`, {
      org: org
    })) {
      console.log("link:", response.headers.link)
      if (response.status === 200 || response.status === 201) {
        entries.push(response.data)
      } else {
        console.log(`Could not retrieve page ${response.headers.link}`)
      }

      if (hasLimit) {
        if (entries.length >= limit) {
          entries = entries.slice(0, limit)
        }
        break;
      }
    }
  } catch (error) {
    console.log(error)
    process.exit(1)
  }
  return { data: entries, newestCursorId: null }
}

module.exports = {
  requestV4Entries,
  requestV3Entries,
}
