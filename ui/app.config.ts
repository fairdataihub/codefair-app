export default defineAppConfig({
  docus: {
    title: "Codefair",
    aside: {
      collapsed: false,
      exclude: [],
      level: 0,
    },
    description:
      "Make your research software reusable without breaking a sweat!",
    github: {
      branch: "main",
      dir: "blob/main/content",
      edit: true,
      owner: "fairdataihub",
      repo: "codefair-app",
    },
    main: {
      fluid: true,
      padded: true,
    },
    socials: {
      github: "fairdataihub/codefair-app",
      twitter: "fairdataihub",
    },
    // header: {
    //   logo: true,
    //   title: "codefair",
    //   showLinkIcon: true,
    //   exclude: [],
    //   fluid: true,
    // },
    // footer: {
    //   credits: {
    //     icon: "IconDocus",
    //     text: "Powered by Docus",
    //     href: "https://docus.dev",
    //   },
    //   textLinks: [
    //     {
    //       text: "Made with ❤️ by fairdataihub",
    //       href: "https://fairdataihub.org",
    //     },
    //   ],
    //   iconLinks: [
    //     {
    //       href: "https://nuxt.com",
    //       icon: "simple-icons:nuxtdotjs",
    //     },
    //   ],
    // },
  },
});
