/*
 * soup__dump.js
 */


const gi = require('../lib/')
const soup = gi.require('Soup')

const input = 'Content-Type;q=1, Accept;q=0.2, X-Custom;q=0.1, Zero;q=0'

const fn = () => console.log(soup.header_parse_quality_list(input))

Array(1000000).fill(0).forEach(fn)
