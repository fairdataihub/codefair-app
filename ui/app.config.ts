export default defineAppConfig({
  docus: {
    title: "codefair",
    description:
      "Make your research software reusable without breaking a sweat!",
    socials: {
      twitter: "fairdataihub",
      github: "fairdataihub/codefair-app",
    },
    github: {
      dir: "blob/main/content",
      branch: "main",
      repo: "codefair-app",
      owner: "fairdataihub",
      edit: true,
    },
    aside: {
      level: 0,
      collapsed: false,
      exclude: [],
    },
    main: {
      padded: true,
      fluid: true,
    },
    header: {
      logo: true,
      title: "codefair",
      showLinkIcon: true,
      exclude: [],
      fluid: true,
    },
    footer: {
      credits: {
        icon: "IconDocus",
        text: "Powered by Docus",
        href: "https://docus.dev",
      },
      textLinks: [
        {
          text: "Made with ❤️ by fairdataihub",
          href: "https://fairdataihub.org",
        },
      ],
      iconLinks: [
        {
          href: "https://nuxt.com",
          icon: "simple-icons:nuxtdotjs",
        },
      ],
    },
  },
});
