export default {
  transpilePackages:['@flowbar/gen-contracts'],
  async rewrites(){return [{source:'/api/:path*',destination:`${process.env.COMMUNITY_API_ORIGIN??'http://127.0.0.1:4421'}/api/:path*`}];},
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'},{key:'X-Frame-Options',value:'DENY'}]}];}
};
