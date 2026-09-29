package crap;

import java.io.File;
import java.util.Locale;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** CRAP = complexity^2 * (1 - coverage)^3 + complexity. JDK only, no third-party deps. */
public final class Crap {

  public static void main(String[] args) throws Exception {
    if (args.length < 1) {
      System.err.println("Usage: Crap <jacoco.xml> [threshold=6] [failAbove=false]");
      System.exit(2);
    }
    File xml = new File(args[0]);
    if (!xml.isFile()) {
      System.err.println("[crap] JaCoCo report not found: " + xml.getAbsolutePath());
      System.exit(2);
    }
    double threshold = args.length > 1 ? Double.parseDouble(args[1]) : 6.0;
    boolean failAbove = args.length > 2 && Boolean.parseBoolean(args[2]);

    Document doc = newBuilder().parse(xml);
    NodeList classes = doc.getElementsByTagName("class");

    int over = 0;
    int methods = 0;
    double worst = 0.0;
    String worstAt = "";

    for (int i = 0; i < classes.getLength(); i++) {
      Element cls = (Element) classes.item(i);
      String clsName = cls.getAttribute("name");
      NodeList ms = cls.getElementsByTagName("method");
      for (int j = 0; j < ms.getLength(); j++) {
        Element m = (Element) ms.item(j);
        int cc = counterSum(m, "COMPLEXITY");
        if (cc == 0) {           // abstract/interface/synthetic, skip
          continue;
        }
        double coverage = counterRatio(m, "INSTRUCTION");
        double crap = cc * cc * Math.pow(1.0 - coverage, 3) + cc;
        methods++;
        if (crap > worst) {
          worst = crap;
          worstAt = clsName + "#" + m.getAttribute("name");
        }
        if (crap > threshold) {
          over++;
          System.out.printf(Locale.ROOT,
              "CRAP %6.1f  %s#%s (cc=%d, cov=%.0f%%)%n",
              crap, clsName, m.getAttribute("name"), cc, coverage * 100.0);
        }
      }
    }

    System.out.printf(Locale.ROOT,
        "[crap] methods=%d, threshold=%.1f, over=%d, worst=%.1f (%s)%n",
        methods, threshold, over, worst, worstAt);

    if (over > 0 && failAbove) {
      System.exit(1);
    }
  }

  private static DocumentBuilder newBuilder() throws Exception {
    DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
    f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    f.setXIncludeAware(false);
    f.setExpandEntityReferences(false);
    return f.newDocumentBuilder();
  }

  /** JaCoCo counter = covered + missed (e.g. COMPLEXITY). */
  private static int counterSum(Element scope, String type) {
    NodeList cs = scope.getElementsByTagName("counter");
    for (int k = 0; k < cs.getLength(); k++) {
      Element c = (Element) cs.item(k);
      if (type.equals(c.getAttribute("type"))) {
        return intOf(c.getAttribute("covered")) + intOf(c.getAttribute("missed"));
      }
    }
    return 0;
  }

  /** JaCoCo coverage = covered / (covered + missed); no counter means covered. */
  private static double counterRatio(Element scope, String type) {
    NodeList cs = scope.getElementsByTagName("counter");
    for (int k = 0; k < cs.getLength(); k++) {
      Element c = (Element) cs.item(k);
      if (type.equals(c.getAttribute("type"))) {
        int covered = intOf(c.getAttribute("covered"));
        int total = covered + intOf(c.getAttribute("missed"));
        return total == 0 ? 1.0 : (double) covered / total;
      }
    }
    return 1.0;
  }

  private static int intOf(String s) {
    return s == null || s.isEmpty() ? 0 : Integer.parseInt(s);
  }

  private Crap() {
  }
}
